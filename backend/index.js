require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');
const path       = require('path');
const fs         = require('fs');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const multer   = require('multer');
const crypto   = require('crypto');
const { quotes: q, contacts: c, proposals: p, bulkUpsertContacts } = require('./db');

const ses = new SESClient({
  region:      process.env.AWS_SES_REGION || 'af-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const SES_FROM   = 'gustav@klieknet.com';
const APP_URL    = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

const app  = express();
const PORT = process.env.PORT || 3000;

const TOKEN_URL  = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
const GRAPH      = 'https://graph.microsoft.com/v1.0';
const TARGET_USER = process.env.MICROSOFT_USER_ID;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ── App-only token cache ──────────────────────────────────────────
let cachedToken  = null;
let tokenExpires = 0;

async function getAppToken() {
  if (cachedToken && Date.now() < tokenExpires - 60_000) return cachedToken;

  const { data } = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      client_id:     process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      scope:         'https://graph.microsoft.com/.default',
      grant_type:    'client_credentials',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  cachedToken  = data.access_token;
  tokenExpires = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ── Graph helper ──────────────────────────────────────────────────
async function graph(path, params = {}) {
  const token = await getAppToken();
  const { data } = await axios.get(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return data;
}

// Follows @odata.nextLink until exhausted or `limit` messages collected.
// Requests 999 items per page (Graph API max).
async function graphPaginate(path, params = {}, limit = Infinity) {
  const token   = await getAppToken();
  const headers = { Authorization: `Bearer ${token}` };
  const items   = [];
  let url       = `${GRAPH}${path}`;
  let reqParams = { ...params, $top: 999 };

  while (url && items.length < limit) {
    const { data } = await axios.get(url, { headers, params: reqParams });
    const batch = data.value ?? [];
    const remaining = limit - items.length;
    items.push(...batch.slice(0, remaining));
    url       = items.length < limit ? (data['@odata.nextLink'] ?? null) : null;
    reqParams = null; // nextLink already carries params
  }

  return items;
}

// Merge an address into the shared seen-map, tracking count/roles/lastSeen.
function mergeAddress(seen, addr, role, timestamp) {
  if (!addr?.address) return;
  const key = addr.address.toLowerCase();
  if (seen.has(key)) {
    const e = seen.get(key);
    e.count++;
    e.roles.add(role);
    if (timestamp > e.lastSeen) e.lastSeen = timestamp;
    if (!e.name && addr.name) e.name = addr.name;
  } else {
    seen.set(key, { name: addr.name || '', address: addr.address, lastSeen: timestamp, count: 1, roles: new Set([role]) });
  }
}

function seenToContacts(seen) {
  return [...seen.values()]
    .map(e => ({ ...e, roles: [...e.roles] }))
    .sort((a, b) => b.count - a.count);
}

// Folders to skip when doing a full-mailbox scan
const NOISE_FOLDERS = new Set([
  'junk email', 'junk e-mail', 'deleted items', 'rss subscriptions',
  'social activity notifications', 'clutter', 'news feed',
  'sync issues', 'conversation history', 'outbox',
]);

// ── External-only filter ──────────────────────────────────────────

// Own domains derived from the target user + tenant
const OWN_DOMAIN = TARGET_USER?.split('@')[1]?.toLowerCase() ?? '';

// Local-part prefixes/patterns that signal automated mail
const NOISE_LOCAL_RE = /^(no[-.]?reply|do[-.]?not[-.]?reply|bounce[sd]?|mailer[-.]?daemon|postmaster|newsletter[s]?|notification[s]?|unsubscribe[d]?|automat|autorespond|noreply|donotreply|updates?|alerts?|digest|support-noreply|system)/i;

// Domain-level patterns: bulk ESPs and transactional infrastructure
const NOISE_DOMAIN_RE = /sendgrid\.net$|mailchimp\.com$|mailgun\.(org|net)$|constantcontact\.com$|exacttarget\.com$|salesforce\.com$|marketo\.net$|hubspot(email)?\.com$|campaignmonitor\.com$|cmail\d*\.com$|klick\.co\.za$|mandrillapp\.com$|amazonses\.com$|mail\.onedayonly\.co\.za$|mailer\.|\.mailer\./i;

// Known transactional or newsletter domains (full match)
const NOISE_DOMAINS = new Set([
  'onedayonly.co.za', 'archdaily.com', 'envato.com',
  'netflix.com', 'facebook.com', 'twitter.com', 'x.com',
  'linkedin.com', 'instagram.com', 'youtube.com', 'google.com',
  'accounts.google.com', 'noreply.github.com',
  'absa.co.za', 'fnb.co.za', 'standardbank.co.za', 'nedbank.co.za',
]);

function isNoise(address) {
  if (!address) return true;
  const lower  = address.toLowerCase();
  const atIdx  = lower.indexOf('@');
  if (atIdx < 1) return true;
  const local  = lower.slice(0, atIdx);
  const domain = lower.slice(atIdx + 1);

  if (!domain) return true;
  if (domain === OWN_DOMAIN)                    return true; // own mailbox
  if (domain.endsWith('.onmicrosoft.com'))       return true; // tenant internal
  if (NOISE_LOCAL_RE.test(local))               return true; // automated local part
  if (NOISE_DOMAIN_RE.test(domain))             return true; // ESP / bulk infra
  if (NOISE_DOMAINS.has(domain))                return true; // known noise domain
  return false;
}

// ── Contact Folders ───────────────────────────────────────────────
app.get('/api/sync/folders', async (req, res) => {
  try {
    const data = await graph(`/users/${TARGET_USER}/contactFolders`, {
      $select: 'id,displayName,parentFolderId',
      $top:    100,
    });

    // The root "Contacts" folder is implicit — always prepend it
    const folders = [
      { id: 'default', name: 'Contacts (default)', parentId: null },
      ...(data.value ?? []).map(f => ({
        id:       f.id,
        name:     f.displayName,
        parentId: f.parentFolderId,
      })),
    ];

    res.json({ folders, count: folders.length });
  } catch (err) {
    console.error('Folders error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to fetch contact folders' });
  }
});

// ── Contacts ──────────────────────────────────────────────────────
// ?folder=<folder-id>  → contacts in that folder
// (no param)           → contacts in the default folder
app.get('/api/sync/contacts', async (req, res) => {
  const folderId = typeof req.query.folder === 'string' && req.query.folder.trim()
    ? req.query.folder.trim()
    : null;

  const path = folderId
    ? `/users/${TARGET_USER}/contactFolders/${folderId}/contacts`
    : `/users/${TARGET_USER}/contacts`;

  try {
    const data = await graph(path, {
      $select: 'displayName,emailAddresses,mobilePhone,companyName',
      $top:    100,
    });

    const contacts = (data.value ?? []).map(c => ({
      name:    c.displayName,
      email:   c.emailAddresses?.[0]?.address ?? '',
      phone:   c.mobilePhone ?? '',
      company: c.companyName ?? '',
    }));

    res.json({ contacts, count: contacts.length, folder: folderId ?? 'default' });
  } catch (err) {
    console.error('Contacts error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to fetch contacts' });
  }
});

// ── Calendar (next 30 days) ───────────────────────────────────────
app.get('/api/sync/calendar', async (req, res) => {
  try {
    const start = new Date().toISOString();
    const end   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const data = await graph(`/users/${TARGET_USER}/calendarView`, {
      startDateTime: start,
      endDateTime:   end,
      $select:       'subject,start,end,location,attendees',
      $top:          50,
    });

    const events = (data.value ?? []).map(e => ({
      subject:   e.subject,
      start:     e.start.dateTime,
      end:       e.end.dateTime,
      location:  e.location?.displayName ?? '',
      attendees: (e.attendees ?? []).map(a => a.emailAddress?.address).filter(Boolean),
    }));

    res.json({ events, count: events.length });
  } catch (err) {
    console.error('Calendar error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to fetch calendar' });
  }
});

// ── Emails ────────────────────────────────────────────────────────
app.get('/api/sync/emails', async (req, res) => {
  const keyword = typeof req.query.search === 'string' && req.query.search.trim()
    ? req.query.search.trim()
    : 'quote';

  try {
    const data = await graph(`/users/${TARGET_USER}/messages`, {
      $search: `"${keyword}"`,
      $select: 'subject,from,receivedDateTime,isRead,bodyPreview',
      $top:    25,
    });

    const emails = (data.value ?? []).map(m => ({
      subject:  m.subject,
      from:     m.from?.emailAddress?.address,
      received: m.receivedDateTime,
      isRead:   m.isRead,
      preview:  m.bodyPreview,
    }));

    res.json({ emails, count: emails.length });
  } catch (err) {
    console.error('Emails error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to fetch emails' });
  }
});

// ── Mail Folders ──────────────────────────────────────────────────
app.get('/api/sync/mail-folders', async (req, res) => {
  try {
    const data = await graph(`/users/${TARGET_USER}/mailFolders`, {
      $select:           'id,displayName,totalItemCount,unreadItemCount',
      $top:              100,
      includeHiddenFolders: true,
    });

    const folders = (data.value ?? []).map(f => ({
      id:          f.id,
      name:        f.displayName,
      total:       f.totalItemCount,
      unread:      f.unreadItemCount,
    }));

    res.json({ folders, count: folders.length });
  } catch (err) {
    console.error('Mail folders error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to fetch mail folders' });
  }
});

// ── Folder Emails — extract unique senders/recipients ─────────────
// ?folder=<folder-id>   required
// ?top=<n>              messages to scan (default 100, max 500)
app.get('/api/sync/folder-emails', async (req, res) => {
  const folderId = typeof req.query.folder === 'string' && req.query.folder.trim()
    ? req.query.folder.trim()
    : null;

  if (!folderId) {
    return res.status(400).json({ error: 'folder query parameter is required' });
  }

  const top = Math.min(parseInt(req.query.top) || 100, 500);

  try {
    const messages = await graphPaginate(
      `/users/${TARGET_USER}/mailFolders/${folderId}/messages`,
      { $select: 'from,toRecipients,ccRecipients,receivedDateTime', $orderby: 'receivedDateTime desc' },
      top
    );

    const seen = new Map();
    for (const msg of messages) {
      mergeAddress(seen, msg.from?.emailAddress, 'sender', msg.receivedDateTime);
      (msg.toRecipients ?? []).forEach(r => mergeAddress(seen, r.emailAddress, 'to', msg.receivedDateTime));
      (msg.ccRecipients ?? []).forEach(r => mergeAddress(seen, r.emailAddress, 'cc', msg.receivedDateTime));
    }

    res.json({ contacts: seenToContacts(seen), unique: seen.size, scanned: messages.length, folder: folderId });
  } catch (err) {
    console.error('Folder emails error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to fetch folder emails' });
  }
});

// ── All Emails — scan every folder, deduplicate globally ──────────
// ?topPerFolder=<n>    messages per folder (default: all)
// ?exclude=<names>     comma-separated folder names to skip (adds to default noise list)
// ?onlyExternal=true   strip own domain, no-reply, newsletters, transactional senders
app.get('/api/sync/all-emails', async (req, res) => {
  const topPerFolder  = req.query.topPerFolder ? Math.min(parseInt(req.query.topPerFolder), 50000) : Infinity;
  const onlyExternal  = req.query.onlyExternal === 'true';
  const extraExclude  = typeof req.query.exclude === 'string'
    ? new Set(req.query.exclude.split(',').map(s => s.trim().toLowerCase()))
    : new Set();

  try {
    // 1. Fetch all folders
    const folderData = await graph(`/users/${TARGET_USER}/mailFolders`, {
      $select:              'id,displayName,totalItemCount',
      $top:                 100,
      includeHiddenFolders: true,
    });

    const folders = (folderData.value ?? []).filter(f => {
      const name = f.displayName.toLowerCase();
      return f.totalItemCount > 0 && !NOISE_FOLDERS.has(name) && !extraExclude.has(name);
    });

    // 2. Scan each folder, merge into global seen-map
    const seen    = new Map();
    const summary = [];

    for (const folder of folders) {
      try {
        const messages = await graphPaginate(
          `/users/${TARGET_USER}/mailFolders/${folder.id}/messages`,
          { $select: 'from,toRecipients,ccRecipients,receivedDateTime' },
          topPerFolder
        );

        const before = seen.size;
        for (const msg of messages) {
          mergeAddress(seen, msg.from?.emailAddress, 'sender', msg.receivedDateTime);
          (msg.toRecipients ?? []).forEach(r => mergeAddress(seen, r.emailAddress, 'to', msg.receivedDateTime));
          (msg.ccRecipients ?? []).forEach(r => mergeAddress(seen, r.emailAddress, 'cc', msg.receivedDateTime));
        }

        summary.push({ folder: folder.displayName, scanned: messages.length, newAddresses: seen.size - before });
        console.log(`  ${folder.displayName}: ${messages.length} messages, ${seen.size - before} new addresses`);
      } catch (folderErr) {
        console.warn(`  Skipped ${folder.displayName}:`, folderErr.response?.data?.error?.message ?? folderErr.message);
        summary.push({ folder: folder.displayName, scanned: 0, error: true });
      }
    }

    let contacts = seenToContacts(seen);
    if (onlyExternal) contacts = contacts.filter(c => !isNoise(c.address));

    res.json({
      contacts,
      unique:   contacts.length,
      total:    seen.size,
      filtered: onlyExternal ? seen.size - contacts.length : 0,
      summary,
    });
  } catch (err) {
    console.error('All-emails error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to scan mailbox' });
  }
});

// ── Users (list all in tenant) ────────────────────────────────────
app.get('/api/sync/users', async (req, res) => {
  try {
    const data = await graph('/users', {
      $select: 'id,displayName,mail,userPrincipalName,jobTitle',
      $top:    50,
    });

    res.json({ users: data.value ?? [], count: data.value?.length ?? 0 });
  } catch (err) {
    console.error('Users error:', err.response?.data ?? err.message);
    res.status(502).json({ error: 'Failed to fetch users' });
  }
});

// ── Quotes ────────────────────────────────────────────────────────
function parseQuote(row) {
  return { ...row, line_items: JSON.parse(row.line_items || '[]') };
}
function quotePayload(body, existing = {}) {
  return {
    quote_number:     body.quote_number     ?? existing.quote_number     ?? '',
    date_issued:      body.date_issued      ?? existing.date_issued      ?? null,
    valid_until:      body.valid_until      ?? existing.valid_until      ?? null,
    contact_person:   body.contact_person   ?? existing.contact_person   ?? '',
    company_name:     body.company_name     ?? existing.company_name     ?? '',
    client_email:     body.client_email     ?? existing.client_email     ?? '',
    client_phone:     body.client_phone     ?? existing.client_phone     ?? '',
    client_address:   body.client_address   ?? existing.client_address   ?? '',
    website_url:      body.website_url      ?? existing.website_url      ?? '',
    job_summary:      body.job_summary      ?? existing.job_summary      ?? '',
    additional_notes: body.additional_notes ?? existing.additional_notes ?? '',
    prepared_by:      body.prepared_by      ?? existing.prepared_by      ?? '',
    quote_name:       body.quote_name       ?? existing.quote_name       ?? '',
    line_items:       JSON.stringify(body.line_items ?? JSON.parse(existing.line_items || '[]')),
    deposit_pct:      body.deposit_pct      ?? existing.deposit_pct      ?? 60,
    subtotal:         body.subtotal         ?? existing.subtotal         ?? 0,
    grand_total:      body.grand_total      ?? existing.grand_total      ?? 0,
    deposit_amount:   body.deposit_amount   ?? existing.deposit_amount   ?? 0,
    balance_amount:   body.balance_amount   ?? existing.balance_amount   ?? 0,
    status:           body.status           ?? existing.status           ?? 'draft',
  };
}

app.get('/api/quotes', (req, res) => {
  try {
    const rows = req.query.status ? q.byStatus.all(req.query.status) : q.all.all();
    res.json(rows.map(parseQuote));
  } catch (err) {
    console.error('GET /api/quotes:', err.message);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

app.get('/api/quotes/:id', (req, res) => {
  try {
    const row = q.byId.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Quote not found' });
    res.json(parseQuote(row));
  } catch (err) {
    console.error('GET /api/quotes/:id:', err.message);
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

app.post('/api/quotes', (req, res) => {
  try {
    const payload = quotePayload(req.body);
    const result  = q.insert.run(payload);
    res.status(201).json(parseQuote(q.byId.get(result.lastInsertRowid)));
  } catch (err) {
    console.error('POST /api/quotes:', err.message);
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

app.put('/api/quotes/:id', (req, res) => {
  try {
    const row = q.byId.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Quote not found' });
    q.update.run({ ...quotePayload(req.body, row), id: row.id });
    res.json(parseQuote(q.byId.get(row.id)));
  } catch (err) {
    console.error('PUT /api/quotes/:id:', err.message);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

app.delete('/api/quotes/:id', (req, res) => {
  try {
    const row = q.byId.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Quote not found' });
    q.delete.run(req.params.id);
    res.json({ deleted: true, id: row.id });
  } catch (err) {
    console.error('DELETE /api/quotes/:id:', err.message);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Publish quote — generate token + send email ───────────────────
app.post('/api/quotes/:id/publish', async (req, res) => {
  try {
    const row = q.byId.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Quote not found' });

    const token = crypto.randomBytes(28).toString('hex');
    q.publish.run({ id: row.id, access_token: token });

    const link       = `${APP_URL}/quote-view.html?token=${token}`;
    const quoteNum   = row.quote_number || `Quote #${row.id}`;
    const clientName = row.contact_person || row.company_name || 'Client';
    const clientEmail = row.client_email;
    let emailSent = false;

    if (clientEmail) {
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f5f3">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <tr><td style="background:#111;padding:28px 40px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="width:38px;height:38px;background:#a3c24d;border-radius:50%;text-align:center;vertical-align:middle;font-weight:800;font-size:18px;color:white">K</td>
      <td style="padding-left:12px;color:white;font-weight:700;font-size:14px;letter-spacing:.08em">KLIEKNET</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:15px;color:#333">Dear <strong>${escHtml(clientName)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">Please find your quotation <strong>${escHtml(quoteNum)}</strong> ready for your review.</p>
    <table cellpadding="0" cellspacing="0"><tr><td style="background:#a3c24d;border-radius:5px">
      <a href="${link}" style="display:inline-block;padding:13px 28px;color:white;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.03em">View Quotation →</a>
    </td></tr></table>
    <p style="margin:24px 0 0;font-size:12px;color:#aaa">Or copy this link:<br><span style="color:#555">${link}</span></p>
  </td></tr>
  <tr><td style="background:#f8f8f6;padding:18px 40px;text-align:center;font-size:11px;color:#aaa">
    Stellenbosch &nbsp;·&nbsp; +27 (0)84 9000 193 &nbsp;·&nbsp; gustav@klieknet.com
  </td></tr>
</table></td></tr></table></body></html>`;

      try {
        await sesSend(clientEmail, `Quotation ${quoteNum} — Klieknet`, html,
          `Dear ${clientName},\n\nYour quotation ${quoteNum} is ready.\n\nView it here: ${link}\n\nKlieknet Web Development`);
        emailSent = true;
      } catch (mailErr) {
        console.warn('[publish] email failed:', mailErr.message);
      }
    }

    res.json({ ok: true, token, link, emailSent, clientEmail: clientEmail || null });
  } catch (err) {
    console.error('POST /api/quotes/:id/publish:', err.message);
    res.status(500).json({ error: 'Failed to publish quote' });
  }
});

// ── Client quote view by token ────────────────────────────────────
app.get('/api/quote-view/:token', (req, res) => {
  try {
    const row = q.byToken.get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Quote not found or link invalid' });
    res.json(parseQuote(row));
  } catch (err) {
    console.error('GET /api/quote-view/:token:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Client accepts quote ──────────────────────────────────────────
app.post('/api/quote-view/:token/accept', (req, res) => {
  try {
    const row = q.byToken.get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Quote not found or link invalid' });
    q.updateStatus.run({ id: row.id, status: 'approved' });
    res.json({ ok: true, status: 'approved' });
  } catch (err) {
    console.error('POST /api/quote-view/:token/accept:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Proposals ─────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.get('/api/proposals', (req, res) => {
  try { res.json(p.all.all()); }
  catch (err) { res.status(500).json({ error: 'Failed to fetch proposals' }); }
});

app.post('/api/proposals', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const code   = crypto.randomBytes(4).toString('hex').toUpperCase();
    const result = p.insert.run({
      title:        req.body.title        || req.file.originalname,
      client_name:  req.body.client_name  || '',
      client_email: req.body.client_email || '',
      filename:     req.file.originalname,
      filepath:     req.file.filename,
      access_code:  code,
      status:       'active',
    });
    res.status(201).json({ ...p.byId.get(result.lastInsertRowid), access_url: `${APP_URL}/client?code=${code}` });
  } catch (err) {
    console.error('POST /api/proposals:', err.message);
    res.status(500).json({ error: 'Failed to save proposal' });
  }
});

app.delete('/api/proposals/:id', (req, res) => {
  try {
    const row = p.byId.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const fp = path.join(uploadsDir, row.filepath);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    p.delete.run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: 'Failed to delete' }); }
});

// Client portal — verify code and serve file
app.get('/api/client/:code', (req, res) => {
  try {
    const row = p.byCode.get(req.params.code);
    if (!row || row.status !== 'active') return res.status(404).json({ error: 'Invalid or expired link' });
    res.json({ title: row.title, client_name: row.client_name, filename: row.filename });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/client/:code/download', (req, res) => {
  try {
    const row = p.byCode.get(req.params.code);
    if (!row || row.status !== 'active') return res.status(404).send('Not found');
    const fp = path.join(uploadsDir, row.filepath);
    if (!fs.existsSync(fp)) return res.status(404).send('File not found');
    res.download(fp, row.filename);
  } catch (err) { res.status(500).send('Server error'); }
});

// ── Contacts (DB) ─────────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  try {
    const rows = req.query.segment ? c.bySegment.all(req.query.segment) : c.all.all();
    const q2   = req.query.q;
    if (q2) return res.json(c.search.all({ q: `%${q2}%` }));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/contacts:', err.message);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

app.get('/api/contacts/:id', (req, res) => {
  try {
    const row = c.byId.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Contact not found' });
    res.json(row);
  } catch (err) {
    console.error('GET /api/contacts/:id:', err.message);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const { email, name = '', contactCount = 0, segment = 'untagged', notes = '', lastInteraction = null } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const result = c.insert.run({ email, name, contactCount, segment, notes, lastInteraction });
    res.status(201).json(c.byId.get(result.lastInsertRowid));
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Contact with this email already exists' });
    console.error('POST /api/contacts:', err.message);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    const row = c.byId.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Contact not found' });

    const { name, contactCount, segment, notes, lastInteraction, approved, directMarketing } = req.body;
    c.update.run({
      id:              row.id,
      name:            name            ?? row.name,
      contactCount:    contactCount    ?? row.contactCount,
      segment:         segment         ?? row.segment,
      notes:           notes           ?? row.notes,
      lastInteraction: lastInteraction ?? row.lastInteraction,
      approved:        approved        !== undefined ? (approved        ? 1 : 0) : row.approved,
      directMarketing: directMarketing !== undefined ? (directMarketing ? 1 : 0) : (row.directMarketing ?? 0),
    });
    res.json(c.byId.get(row.id));
  } catch (err) {
    console.error('PUT /api/contacts/:id:', err.message);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// ── Contacts import from mail scan ────────────────────────────────
// POST /api/contacts/import
// Body: { contacts: [{ address, name, count, lastSeen }] }  — same shape as /api/sync/all-emails
// Or:   { fromScan: true, onlyExternal: true }              — triggers a live scan then imports
app.post('/api/contacts/import', async (req, res) => {
  try {
    let incoming = req.body.contacts;

    if (!incoming && req.body.fromScan) {
      // Run the mail scan inline and use its results
      const onlyExternal = req.body.onlyExternal !== false; // default true
      const topPerFolder = req.body.topPerFolder ? Math.min(parseInt(req.body.topPerFolder), 50000) : Infinity;

      const folderData = await graph(`/users/${TARGET_USER}/mailFolders`, {
        $select: 'id,displayName,totalItemCount', $top: 100, includeHiddenFolders: true,
      });

      const folders = (folderData.value ?? []).filter(f => {
        const name = f.displayName.toLowerCase();
        return f.totalItemCount > 0 && !NOISE_FOLDERS.has(name);
      });

      const seen = new Map();
      for (const folder of folders) {
        try {
          const messages = await graphPaginate(
            `/users/${TARGET_USER}/mailFolders/${folder.id}/messages`,
            { $select: 'from,toRecipients,ccRecipients,receivedDateTime' },
            topPerFolder
          );
          for (const msg of messages) {
            mergeAddress(seen, msg.from?.emailAddress, 'sender', msg.receivedDateTime);
            (msg.toRecipients ?? []).forEach(r => mergeAddress(seen, r.emailAddress, 'to', msg.receivedDateTime));
            (msg.ccRecipients ?? []).forEach(r => mergeAddress(seen, r.emailAddress, 'cc', msg.receivedDateTime));
          }
        } catch (_) { /* skip inaccessible folders */ }
      }

      incoming = seenToContacts(seen);
      if (onlyExternal) incoming = incoming.filter(c => !isNoise(c.address));
    }

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return res.status(400).json({ error: 'Provide contacts array or { fromScan: true }' });
    }

    const rows = incoming.map(contact => ({
      email:           (contact.address || contact.email || '').toLowerCase().trim(),
      name:            contact.name || '',
      contactCount:    contact.count ?? contact.contactCount ?? 0,
      lastInteraction: contact.lastSeen ?? contact.lastInteraction ?? null,
    })).filter(r => r.email);

    bulkUpsertContacts(rows);

    res.json({ imported: rows.length });
  } catch (err) {
    console.error('POST /api/contacts/import:', err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

// ── Email helpers ─────────────────────────────────────────────────
const TEMPLATE_PATH = process.env.EMAIL_TEMPLATE_PATH ||
  path.join(__dirname, '..', '..', 'klieknet-website', 'email-template-aws.html');

function unsubscribeUrl(email) {
  return `${APP_URL}/api/unsubscribe?email=${encodeURIComponent(email)}`;
}

function unsubscribeFooter(email) {
  const link = unsubscribeUrl(email);
  return {
    html: `<p style="font-size:11px;color:#999;margin-top:32px">Don't want to receive these emails? <a href="${link}" style="color:#999">Unsubscribe</a></p>`,
    text: `\n\n---\nTo unsubscribe: ${link}`,
  };
}

// Low-level SES send — no footer injected, caller handles body
async function sesSend(to, subject, html, text) {
  const cmd = new SendEmailCommand({
    Source:      SES_FROM,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        ...(html && { Html: { Data: html, Charset: 'UTF-8' } }),
        ...(text && { Text: { Data: text, Charset: 'UTF-8' } }),
      },
    },
  });
  const result = await ses.send(cmd);
  return result.MessageId;
}

// Parse a CSV body into an array of email strings.
// Accepts: comma/newline-delimited plain emails, or CSV with an "email" column header.
function parseCsvEmails(csv) {
  const lines  = csv.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const emails = [];

  // Detect header row
  const firstLow = lines[0]?.toLowerCase() ?? '';
  if (firstLow.includes('email') || firstLow.includes('name')) {
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const emailIdx = headers.findIndex(h => h === 'email');
    if (emailIdx < 0) return [];
    for (const line of lines.slice(1)) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const email = cols[emailIdx]?.toLowerCase();
      if (email && email.includes('@')) emails.push(email);
    }
  } else {
    // Plain comma or newline list
    for (const chunk of lines.flatMap(l => l.split(','))) {
      const email = chunk.trim().toLowerCase().replace(/^"|"$/g, '');
      if (email && email.includes('@')) emails.push(email);
    }
  }

  return [...new Set(emails)]; // deduplicate
}

// ── POST /api/send-email ──────────────────────────────────────────
app.post('/api/send-email', async (req, res) => {
  const { to, subject, htmlBody, textBody } = req.body;
  if (!to || !subject || (!htmlBody && !textBody)) {
    return res.status(400).json({ error: 'to, subject, and at least one of htmlBody/textBody are required' });
  }

  try {
    const footer = unsubscribeFooter(to);
    const messageId = await sesSend(
      to, subject,
      htmlBody ? htmlBody + footer.html : null,
      textBody ? textBody + footer.text : null,
    );
    console.log(`[SES] sent to ${to} — ${messageId}`);
    res.json({ sent: true, messageId, to });
  } catch (err) {
    console.error('[SES] send-email error:', err.message);
    res.status(502).json({ error: 'Failed to send email', detail: err.message });
  }
});

// ── POST /api/send-campaign ───────────────────────────────────────
// Body: { csv, subject }
//   csv     — email addresses (plain list or CSV with "email" header column)
//   subject — email subject line
//   htmlBody comes from EMAIL_TEMPLATE_PATH; {{unsubscribeUrl}} is replaced per recipient.
//   Skips contacts marked approved=false in the DB.
app.post('/api/send-campaign', async (req, res) => {
  const { csv, subject } = req.body;
  if (!csv || !subject) {
    return res.status(400).json({ error: 'csv and subject are required' });
  }

  let templateHtml;
  try {
    templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  } catch (err) {
    console.error('[campaign] template read error:', err.message);
    return res.status(500).json({ error: 'Could not read email template', detail: err.message });
  }

  const emails = parseCsvEmails(csv);
  if (emails.length === 0) {
    return res.status(400).json({ error: 'No valid email addresses found in csv' });
  }

  const unapproved = new Set(
    c.all.all().filter(row => row.approved === 0).map(row => row.email.toLowerCase())
  );
  const recipients = emails.filter(e => !unapproved.has(e));

  const results = { sent: [], failed: [], skipped: emails.length - recipients.length };

  for (const to of recipients) {
    const unsub = unsubscribeUrl(to);
    const html  = templateHtml.replace(/\{\{unsubscribeUrl\}\}/g, unsub);
    const text  = `To unsubscribe from this mailing list: ${unsub}`;

    try {
      const messageId = await sesSend(to, subject, html, text);
      console.log(`[SES] campaign → ${to} — ${messageId}`);
      results.sent.push(to);
    } catch (err) {
      console.error(`[SES] campaign failed for ${to}:`, err.message);
      results.failed.push({ to, error: err.message });
    }
    // 70ms between sends ≈ 14 emails/sec — within SES default rate limit
    await new Promise(r => setTimeout(r, 70));
  }

  console.log(`[SES] campaign done — sent:${results.sent.length} failed:${results.failed.length} skipped:${results.skipped}`);
  res.json({ ...results, total: emails.length });
});

// ── GET /api/unsubscribe ──────────────────────────────────────────
app.get('/api/unsubscribe', (req, res) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : null;
  if (!email || !email.includes('@')) {
    return res.status(400).send('Invalid unsubscribe request.');
  }

  try {
    c.unsubscribe.run(email);
    console.log(`[unsubscribe] ${email} marked unapproved`);
    res.send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>` +
      `<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">` +
      `<h2>You have been unsubscribed</h2>` +
      `<p>${email} has been removed from our mailing list.</p>` +
      `</body></html>`
    );
  } catch (err) {
    console.error('[unsubscribe] error:', err.message);
    res.status(500).send('Something went wrong. Please try again later.');
  }
});

// ── Health ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
