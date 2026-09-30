/* ──────────────────────────────────────────────────────────────────
   Debit Order Mandate — online form (mirrors the WPForms form #12)
   - Public submit:   POST /api/public/mandate
   - Dashboard view:  GET  /api/mandates/:id/details   (login)
   - PDF download:    GET  /api/mandates/:id/pdf       (login)
   Sensitive numbers (ID, account, card) are encrypted at rest (AES-256-GCM).
   CVV is never collected.
   ────────────────────────────────────────────────────────────────── */
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const PDFDocument = require('pdfkit');

/* ── Debit amount options (same labels as WPForms) ── */
const DEBIT_OPTIONS = {
  '1': { label: 'R190 [Domain Hosting & SSL - if we point your site from another service provider]', amount: 190 },
  '2': { label: 'R100 + R190 [Domain Registration, Domain Hosting & SSL]', amount: 290 },
  '3': { label: 'R100 + R120 + R250 [Domain Registration, Domain Hosting & SSL, Monthly Retainer]', amount: 470 },
  '4': { label: 'R250 [Monthly Retainer for Website version updates - if hosted at another host]', amount: 250 },
};
const ACCOUNT_TYPES = { savings: 'Savings Account', current: 'Current / Cheque Account', card: 'Credit Card' };
const CARD_TYPES    = { visa: 'Visa', mastercard: 'Mastercard' };

const ASSIGNMENT_TEXT =
  'I / We acknowledge that this Authority may be ceded to or assigned to a third party if the agreement is also ceded or ' +
  'assigned to that third party, but in the absence of such assignment of the Agreement, this Authority and Mandate cannot ' +
  'be assigned to any third party.';
const LEGAL_URL = 'https://www.klieknet.com/word/legal/';

/* ── Encryption key: MANDATE_KEY env (64 hex chars) or a key file on the data disk ── */
function loadKey() {
  const env = (process.env.MANDATE_KEY || '').trim();
  if (/^[0-9a-f]{64}$/i.test(env)) return Buffer.from(env, 'hex');
  const dir = process.env.DATA_DIR || __dirname;
  const file = path.join(dir, '.mandate-key');
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString('hex'), { mode: 0o600 });
  console.warn('[mandates] No MANDATE_KEY set — generated a key file at', file, '(back it up; without it encrypted numbers cannot be read)');
  return key;
}
let KEY = null;
function key() { return KEY || (KEY = loadKey()); }

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return { enc: [iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.') };
}
function decrypt(v) {
  if (!v || typeof v !== 'object' || !v.enc) return v || '';
  try {
    const [iv, tag, data] = v.enc.split('.').map(s => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch (_) { return '[cannot decrypt — key missing]'; }
}
const mask = (s, keep = 4) => { s = String(s || ''); return s.length <= keep ? s : '•••• ' + s.slice(-keep); };

/* ── Validation helpers ── */
const clean  = v => String(v ?? '').trim().slice(0, 500);
const digits = v => String(v ?? '').replace(/\D/g, '');
function validSAId(id) {
  if (!/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let n = +id[12 - i];
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}
function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = +num[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return num.length >= 12 && sum % 10 === 0;
}

function validate(b) {
  const errors = {};
  const need = (k, label) => { if (!clean(b[k])) errors[k] = `${label} is required`; };
  need('first_name', 'First name'); need('last_name', 'Last name');
  need('cell', 'Cell'); need('company', 'Company name'); need('website', 'Website / URL');
  need('email', 'Email'); need('address1', 'Address'); need('city', 'City');
  need('province', 'State / Province / Region'); need('postal', 'Postal code');
  need('agreement_date', 'Date of Agreement');

  if (clean(b.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(b.email))) errors.email = 'Please enter a valid email address';
  const id = digits(b.id_number);
  if (!id) errors.id_number = 'ID Number is required';
  else if (!validSAId(id)) errors.id_number = 'Please enter a valid 13-digit SA ID number';

  if (!DEBIT_OPTIONS[b.debit_option]) errors.debit_option = 'Please choose a debit amount';
  if (clean(b.commencement) && !/^\d{4}-\d{2}$/.test(clean(b.commencement))) errors.commencement = 'Please choose a month';
  if (!ACCOUNT_TYPES[b.account_type]) errors.account_type = 'Please choose the type of account';

  if (b.account_type === 'savings' || b.account_type === 'current') {
    need('bank_name', 'Bank name'); need('branch_code', 'Branch code');
    need('holder_first', 'First name on account'); need('holder_last', 'Last name on account');
    const acc = digits(b.account_number);
    if (!acc) errors.account_number = 'Account number is required';
    else if (acc.length < 6 || acc.length > 16) errors.account_number = 'Please check the account number';
  }
  if (b.account_type === 'card') {
    need('card_holder', 'Card holder name');
    const card = digits(b.card_number);
    if (!card) errors.card_number = 'Card number is required';
    else if (!luhn(card)) errors.card_number = 'Please check the card number';
    if (!/^\d{4}-\d{2}$/.test(clean(b.card_expiry))) errors.card_expiry = 'Expiry date is required';
  }
  if (!(b.agree === true || b.agree === 'true' || b.agree === 'on' || b.agree === '1'))
    errors.agree = 'Please tick the box to agree to the Terms and Conditions';
  return errors;
}

/* ── Simple per-IP rate limit (5 submissions / hour) ── */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), hour = 3600_000;
  const list = (hits.get(ip) || []).filter(t => now - t < hour);
  list.push(now); hits.set(ip, list);
  return list.length > 5;
}

/* ── Form timer: signed "form opened at" stamp. Bots post instantly; people need minutes.
   Signed with a key derived from the mandate key, so it can't be forged and survives redeploys. ── */
const MIN_FILL_MS = 5_000, MAX_FILL_MS = 24 * 3600_000;
const timerSig = t => crypto.createHmac('sha256', key()).update('mandate-form-timer:' + t).digest('hex').slice(0, 32);
function newFormTimer() { const t = Date.now(); return `${t}.${timerSig(t)}`; }
function checkFormTimer(tok) {
  const [t, sig] = String(tok || '').split('.');
  const ts = Number(t);
  if (!ts || !sig || sig.length !== 32) return 'missing';
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(timerSig(ts)))) return 'invalid';
  const age = Date.now() - ts;
  if (age < MIN_FILL_MS) return 'too_fast';
  if (age > MAX_FILL_MS) return 'expired';
  return null;
}

/* ── Decrypted view model (card masked unless reveal) ── */
function detailsFor(row, reveal) {
  const f = JSON.parse(row.form_data || '{}');
  const out = { ...f };
  out.id_number = decrypt(f.id_number);
  if (f.account_number) out.account_number = decrypt(f.account_number);
  if (f.card_number) {
    const full = decrypt(f.card_number);
    out.card_number = reveal ? full : mask(full);
    out.card_masked = !reveal;
  }
  return out;
}

function monthLabel(ym) {
  if (!ym) return '—';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}
function dateLabel(d) {
  if (!d) return '—';
  const x = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return isNaN(x) ? d : x.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}
function sections(f) {
  const s = [
    ['Client', [
      ['Name', `${f.first_name} ${f.last_name}`],
      ['ID Number', f.id_number],
      ['Company Name', f.company],
      ['Website / URL', f.website],
      ['Email', f.email],
      ['Cell', f.cell],
      ['Tel', f.tel || '—'],
      ['Address', [f.address1, f.city, f.province, f.postal].filter(Boolean).join(', ')],
    ]],
    ['Debit Order', [
      ['Debit Amount per Month', f.debit_label],
      ['Monthly total', 'R' + Number(f.amount || 0).toFixed(2)],
      ['Commencement date of first Debit Order', f.commencement ? monthLabel(f.commencement) : '—'],
    ]],
  ];
  if (f.account_type === 'card') {
    s.push(['Credit Card Details', [
      ['Type of Account', ACCOUNT_TYPES.card],
      ['Credit Card Holders Name', f.card_holder],
      ['Card Number', f.card_number],
      ['Expiry Date', f.card_expiry ? f.card_expiry.split('-').reverse().join('/') : '—'],
      ['Card Type', CARD_TYPES[f.card_type] || '—'],
    ]]);
  } else {
    s.push(['Bank Details', [
      ['Type of Account', ACCOUNT_TYPES[f.account_type] || '—'],
      ['Bank Name', f.bank_name],
      ['Branch Code', f.branch_code],
      ['Name on Account', `${f.holder_first} ${f.holder_last}`],
      ['Account Number', f.account_number],
    ]]);
  }
  s.push(['Agreement', [
    ['Terms and Conditions', f.agreed ? 'I Agree — accepted online' : '—'],
    ['Date of Agreement', dateLabel(f.agreement_date)],
    ['Submitted', f.submitted_at ? new Date(f.submitted_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) + ' (SAST)' : '—'],
    ['Submitted from IP', f.submitted_ip || '—'],
  ]]);
  if (f.comment) s.push(['Comment or Message', [['', f.comment]]]);
  return s;
}

/* ── PDF ── */
function buildPdf(res, row, f) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Debit Order Mandate — ${f.company}`, Author: 'KliekNet' } });
  const safe = String(f.company || f.last_name || 'client').replace(/[^a-z0-9]+/gi, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Debit_Order_Mandate_${safe}_${row.id}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  doc.pipe(res);

  const W = doc.page.width, M = 50, CW = W - M * 2;
  const GREEN = '#a3c24d', BLACK = '#0A0A0A', MUTED = '#6B7280', BORDER = '#E5E7EB';

  // Header band
  doc.rect(0, 0, W, 92).fill(BLACK);
  doc.circle(M + 18, 46, 18).fill('#FFFFFF');
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(18).text('K', M + 11.5, 36);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14).text('KLIEK', M + 46, 34, { continued: true }).fillColor(GREEN).text('NET');
  doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7).text('AI-DRIVEN SOLUTIONS', M + 46, 52, { characterSpacing: 1.5 });
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text('DEBIT ORDER MANDATE', M, 32, { width: CW, align: 'right' });
  doc.fillColor('#9CA3AF').font('Helvetica').fontSize(8).text(`Reference #${row.id}  ·  ${f.company || ''}`, M, 50, { width: CW, align: 'right' });
  doc.rect(0, 92, W, 3).fill(GREEN);

  let y = 118;
  const BOTTOM = doc.page.height - 58;   // keep clear of the footer line
  const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = 60; } };

  for (const [title, rows] of sections(f)) {
    ensure(40);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8).text(title.toUpperCase(), M, y, { characterSpacing: 1.4 });
    y += 16;
    for (const [label, value] of rows) {
      const v = String(value ?? '—') || '—';
      const lw = label ? 170 : 0;
      doc.font('Helvetica-Bold').fontSize(9.5);
      const h = Math.max(doc.heightOfString(v, { width: CW - lw - 10 }), 11) + 8;
      ensure(h);
      doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.5).strokeColor(BORDER).stroke();
      if (label) doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(label, M, y + 4, { width: lw - 10, lineBreak: true });
      doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9.5).text(v, M + lw, y + 4, { width: CW - lw - 10 });
      y += h;
    }
    y += 10;
  }

  ensure(70);
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8).text('ASSIGNMENT', M, y, { characterSpacing: 1.4 });
  y += 14;
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(ASSIGNMENT_TEXT, M, y, { width: CW, lineGap: 2 });
  y = doc.y + 6;
  doc.text(`Contract Agreement & Terms and Conditions: ${LEGAL_URL}`, M, y, { width: CW });

  // Footer (drawn inside the bottom margin without triggering a new page)
  const bm = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.moveTo(M, doc.page.height - 44).lineTo(M + CW, doc.page.height - 44).lineWidth(0.5).strokeColor(BORDER).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(
    'KliekNet Web Development · Stellenbosch · gustav@klieknet.com · www.klieknet.com',
    M, doc.page.height - 36, { width: CW, align: 'center', lineBreak: false });
  doc.page.margins.bottom = bm;
  doc.end();
}

/* ── Routes ── */
function register(app, { md, sesSend }) {
  app.get('/api/public/mandate/start', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ timer: newFormTimer() });
  });

  app.post('/api/public/mandate', async (req, res) => {
    try {
      const b = req.body || {};
      if (clean(b.company_fax)) return res.json({ ok: true });            // honeypot → silently drop
      if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many submissions — please try again later.' });
      const timerErr = checkFormTimer(b.form_timer);
      if (timerErr) {
        console.warn('[mandate] blocked submission, form timer:', timerErr, req.ip);
        return res.status(400).json({ error: 'Please check your details and press Submit again.', retry: true });
      }

      const errors = validate(b);
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields', errors });

      const opt = DEBIT_OPTIONS[b.debit_option];
      const isCard = b.account_type === 'card';
      const f = {
        first_name: clean(b.first_name), last_name: clean(b.last_name),
        tel: clean(b.tel), cell: clean(b.cell),
        id_number: encrypt(digits(b.id_number)),
        company: clean(b.company), website: clean(b.website), email: clean(b.email),
        address1: clean(b.address1), city: clean(b.city), province: clean(b.province), postal: clean(b.postal),
        debit_option: b.debit_option, debit_label: opt.label, amount: opt.amount,
        commencement: clean(b.commencement),
        account_type: b.account_type,
        agreed: true, agreement_date: clean(b.agreement_date),
        comment: clean(b.comment).slice(0, 2000),
        submitted_at: new Date().toISOString(), submitted_ip: String(req.ip || '').replace(/^::ffff:/, ''),
        user_agent: String(req.headers['user-agent'] || '').slice(0, 200),
      };
      if (isCard) {
        const card = digits(b.card_number);
        Object.assign(f, {
          card_holder: clean(b.card_holder), card_number: encrypt(card), card_last4: card.slice(-4),
          card_expiry: clean(b.card_expiry), card_type: CARD_TYPES[b.card_type] ? b.card_type : '',
        });
      } else {
        const acc = digits(b.account_number);
        Object.assign(f, {
          bank_name: clean(b.bank_name), branch_code: clean(b.branch_code),
          holder_first: clean(b.holder_first), holder_last: clean(b.holder_last),
          account_number: encrypt(acc), account_last4: acc.slice(-4),
        });
      }

      const result = md.insert.run({
        source: 'form',
        client_name: `${f.first_name} ${f.last_name}`,
        company_name: f.company, client_email: f.email,
        reference: opt.label.split(' [')[0] + ' — ' + (opt.label.match(/\[(.*)\]/)?.[1] || ''),
        amount: opt.amount, filename: '', filepath: '',
        form_data: JSON.stringify(f), status: 'received', notes: f.comment,
      });

      // Notify Gustav — no bank/ID numbers in the email
      const id = result.lastInsertRowid;
      const appUrl = process.env.APP_URL || '';
      sesSend('gustav@klieknet.com',
        `New Entry: Debit Order mandate Form — ${f.company}`,
        `<p>New debit order mandate received.</p>
         <p><strong>${f.first_name} ${f.last_name}</strong> · ${f.company}<br>${f.email} · ${f.cell}<br>
         ${opt.label}<br>Account type: ${ACCOUNT_TYPES[f.account_type]}</p>
         <p><a href="${appUrl}/mandate-view.html?id=${id}">View the mandate in your dashboard →</a></p>
         <p style="color:#888;font-size:12px">Bank, card and ID numbers are not included in this email — they are stored encrypted in the dashboard.</p>`,
        `New debit order mandate from ${f.first_name} ${f.last_name} (${f.company}). View: ${appUrl}/mandate-view.html?id=${id}`
      ).catch(err => console.error('[mandates] notification email failed:', err.message));

      res.status(201).json({ ok: true });
    } catch (err) {
      console.error('POST /api/public/mandate:', err.message);
      res.status(500).json({ error: 'Something went wrong — please try again.' });
    }
  });

  app.get('/api/mandates/:id/details', (req, res) => {
    try {
      const row = md.byId.get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Mandate not found' });
      res.set('Cache-Control', 'private, no-store');
      const f = row.source === 'form' ? detailsFor(row, req.query.reveal === '1') : {};
      res.json({ ...row, form_data: undefined, details: f, sections: row.source === 'form' ? sections(f) : [],
                 assignment: ASSIGNMENT_TEXT, legal_url: LEGAL_URL });
    } catch (err) { console.error('GET details:', err.message); res.status(500).json({ error: 'Failed to load mandate' }); }
  });

  app.get('/api/mandates/:id/pdf', (req, res) => {
    try {
      const row = md.byId.get(req.params.id);
      if (!row || row.source !== 'form') return res.status(404).send('No form mandate with this id');
      buildPdf(res, row, detailsFor(row, true));   // Netcash needs the full numbers
    } catch (err) { console.error('GET pdf:', err.message); res.status(500).send('Failed to build PDF'); }
  });
}

module.exports = { register, DEBIT_OPTIONS, validSAId };
