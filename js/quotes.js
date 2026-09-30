/* ── Sidebar (shared) ── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSidebar(); closePublishModal(); } });

/* ── State ── */
let depositPct     = 60;
let voiceActive    = false;
let recognition    = null;
let currentQuoteId = null;
let nextQuoteNum   = 1;
let currentStatus  = 'draft';
let currentLink    = '';

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const editId    = urlParams.get('id');
  if (editId) {
    await loadQuoteById(editId);
  } else {
    await initBlankQuote();
  }
});

async function initBlankQuote() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('dateIssued').value =
    `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const valid = new Date(now);
  valid.setDate(valid.getDate() + 28);
  document.getElementById('validUntil').value =
    `${valid.getFullYear()}-${pad(valid.getMonth()+1)}-${pad(valid.getDate())}`;

  try {
    const res = await fetch('/api/quotes');
    if (res.ok) {
      const quotes = await res.json();
      // Next number = highest existing QTN sequence + 1 (never reuses a number after deletes)
      const seqs = quotes.map(q => parseInt((q.quote_number || '').match(/^QTN_(\d+)/)?.[1] || 0, 10));
      nextQuoteNum = Math.max(0, ...seqs) + 1;
      const badge = document.getElementById('navQuoteBadge');
      if (badge) badge.textContent = quotes.length || '';
    }
  } catch (_) { nextQuoteNum = 1; }

  updateQuoteNumber();
  addLineItem(); addLineItem(); addLineItem();
  renderEmptyCheck();
}

/* ── Quote Number: QTN_{seq}_{DD}_{MM}_{YY}_{quoteName} ── */
function updateQuoteNumber() {
  if (currentQuoteId) return;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const DD  = pad(now.getDate());
  const MM  = pad(now.getMonth() + 1);
  const YY  = String(now.getFullYear()).slice(2);
  const seq = String(nextQuoteNum).padStart(3, '0');
  const raw = (document.getElementById('quoteName')?.value || '').trim();
  const name = raw.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  document.getElementById('quoteNumber').value =
    `QTN_${seq}_${DD}_${MM}_${YY}${name ? '_' + name : ''}`;
}

/* ── Line Items ── */
function addLineItem(desc='', qty=1, rate=750) {
  removeEmptyRow();
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="col-desc">
      <input type="text" class="li-desc" value="${esc(desc)}" placeholder="Description of work" oninput="calculateTotals()"/>
    </td>
    <td class="col-qty">
      <input type="number" class="li-qty" value="${qty}" min="0" step="0.5" oninput="calculateTotals()"/>
    </td>
    <td class="col-rate">
      <input type="number" class="li-rate" value="${rate}" min="0" step="50" oninput="calculateTotals()"/>
    </td>
    <td class="col-total li-total-cell">${formatR(qty*rate)}</td>
    <td class="col-del">
      <button type="button" class="btn-del" onclick="removeRow(this)" title="Remove">&#x2715;</button>
    </td>`;
  document.getElementById('lineItemsBody').appendChild(tr);
  calculateTotals();
}

function addPreset(select) {
  const val = select.value;
  if (!val) return;
  const [desc, qty, rate] = val.split('|');
  addLineItem(desc, Number(qty), Number(rate));
  select.value = '';
}

function removeRow(btn) {
  btn.closest('tr').remove();
  renderEmptyCheck();
  calculateTotals();
}

function renderEmptyCheck() {
  const tbody = document.getElementById('lineItemsBody');
  const hasRows = tbody.querySelectorAll('tr:not(.empty-row)').length > 0;
  if (!hasRows && !tbody.querySelector('.empty-row')) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = `<td colspan="5" class="empty-items">No line items yet — use Quick Add, Add Row, or Voice Input above.</td>`;
    tbody.appendChild(tr);
  }
}

function removeEmptyRow() {
  const empty = document.querySelector('.empty-row');
  if (empty) empty.remove();
}

/* ── Totals ── */
function calculateTotals() {
  let subtotal = 0;
  document.querySelectorAll('#lineItemsBody tr:not(.empty-row)').forEach(row => {
    const qty   = parseFloat(row.querySelector('.li-qty')?.value) || 0;
    const rate  = parseFloat(row.querySelector('.li-rate')?.value) || 0;
    const total = qty * rate;
    const cell  = row.querySelector('.li-total-cell');
    if (cell) cell.textContent = formatR(total);
    subtotal += total;
  });
  const deposit = subtotal * depositPct / 100;
  const balance = subtotal - deposit;
  document.getElementById('subtotal').textContent      = formatR(subtotal);
  document.getElementById('grandTotal').textContent    = formatR(subtotal);
  document.getElementById('depositAmount').textContent = formatR(deposit);
  document.getElementById('balanceAmount').textContent = formatR(balance);
  document.getElementById('depositLabel').textContent  = `Deposit (${depositPct}%)`;
  document.getElementById('balanceLabel').textContent  = `Balance (${100-depositPct}%)`;
}

function setDeposit(pct) {
  depositPct = pct;
  document.querySelectorAll('.deposit-opt').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.pct) === pct));
  calculateTotals();
}

/* ── Voice Input ── */
function toggleVoice() { voiceActive ? stopVoice() : startVoice(); }

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Voice input requires Chrome or Edge.'); return; }
  recognition = new SR();
  recognition.lang = 'en-ZA';
  recognition.continuous = false;
  recognition.interimResults = false;
  const btn    = document.getElementById('voiceBtn');
  const status = document.getElementById('voiceStatus');
  recognition.onstart = () => {
    voiceActive = true;
    btn.classList.add('listening');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="8" height="10" rx="1"/></svg> Stop`;
    status.classList.remove('hidden');
  };
  recognition.onresult = e => parseVoiceInput(e.results[0][0].transcript);
  recognition.onerror  = () => stopVoice();
  recognition.onend    = () => stopVoice();
  recognition.start();
}

function stopVoice() {
  voiceActive = false;
  if (recognition) { try { recognition.abort(); } catch(_){} }
  const btn = document.getElementById('voiceBtn');
  btn.classList.remove('listening');
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="1" width="6" height="9" rx="3"/><path d="M2 8a6 6 0 0012 0"/><line x1="8" y1="14" x2="8" y2="16"/></svg> Voice`;
  document.getElementById('voiceStatus').classList.add('hidden');
}

const WORD_NUMS = {
  zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
  seventeen:17,eighteen:18,nineteen:19,twenty:20,'twenty-four':24,
  'twenty four':24,thirty:30,forty:40,fifty:50,sixty:60
};

function parseVoiceInput(raw) {
  let text = raw.toLowerCase();
  Object.entries(WORD_NUMS).forEach(([w,n]) =>
    text = text.replace(new RegExp(`\\b${w}\\b`,'g'), String(n)));
  let hours = 1, rate = 750;
  const hm = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hm) { hours = parseFloat(hm[1]); text = text.replace(hm[0],''); }
  const rm = text.match(/(?:r|@|at|rand)?\s*(\d{3,}(?:\s*\d{3})*)\s*(?:rand|per\s*hour|p\.?h\.?)?/i);
  if (rm) { const c = parseFloat(rm[1].replace(/\s/g,'')); if (c>=100){ rate=c; text=text.replace(rm[0],''); } }
  let desc = text.replace(/[,\.]+$/g,'').replace(/^\s*[-,at@]+\s*/g,'').replace(/\s+/g,' ').trim();
  desc = desc.charAt(0).toUpperCase() + desc.slice(1) || 'New item';
  addLineItem(desc, hours, rate);
}

/* ── Collect Form Data ── */
function collectFormData() {
  const rows = [];
  document.querySelectorAll('#lineItemsBody tr:not(.empty-row)').forEach(row => {
    const qty  = parseFloat(row.querySelector('.li-qty')?.value)  || 0;
    const rate = parseFloat(row.querySelector('.li-rate')?.value) || 0;
    rows.push({ desc: row.querySelector('.li-desc')?.value || '', qty, rate, total: qty*rate });
  });
  const subtotal = rows.reduce((s,r) => s+r.total, 0);
  const deposit  = subtotal * depositPct / 100;
  return {
    quoteNumber:     document.getElementById('quoteNumber').value,
    quoteName:       document.getElementById('quoteName').value,
    dateIssued:      document.getElementById('dateIssued').value   || null,
    validUntil:      document.getElementById('validUntil').value   || null,
    preparedBy:      document.getElementById('preparedBy').value,
    contactPerson:   document.getElementById('contactPerson').value,
    companyName:     document.getElementById('companyName').value,
    clientEmail:     document.getElementById('clientEmail').value,
    clientPhone:     document.getElementById('clientPhone').value,
    clientAddress:   document.getElementById('clientAddress').value,
    websiteUrl:      document.getElementById('websiteUrl').value,
    jobSummary:      document.getElementById('jobSummary').value,
    additionalNotes: document.getElementById('additionalNotes').value,
    lineItems: rows, depositPct,
    subtotal, grandTotal: subtotal, depositAmount: deposit, balanceAmount: subtotal-deposit
  };
}

/* ── API Save ── */
async function saveQuote() {
  const data    = collectFormData();
  const payload = {
    quote_number:     data.quoteNumber,
    quote_name:       data.quoteName,
    date_issued:      data.dateIssued,
    valid_until:      data.validUntil,
    prepared_by:      data.preparedBy,
    contact_person:   data.contactPerson,
    company_name:     data.companyName,
    client_email:     data.clientEmail,
    client_phone:     data.clientPhone,
    client_address:   data.clientAddress,
    website_url:      data.websiteUrl,
    job_summary:      data.jobSummary,
    additional_notes: data.additionalNotes,
    line_items:       data.lineItems,
    deposit_pct:      data.depositPct,
    subtotal:         data.subtotal,
    grand_total:      data.grandTotal,
    deposit_amount:   data.depositAmount,
    balance_amount:   data.balanceAmount,
  };

  try {
    const url    = currentQuoteId ? `/api/quotes/${currentQuoteId}` : '/api/quotes';
    const method = currentQuoteId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const saved = await res.json();
    if (!currentQuoteId) {
      currentQuoteId = saved.id;
      window.history.replaceState({}, '', `quotes.html?id=${currentQuoteId}`);
    }
    if (saved.quote_number && saved.quote_number !== data.quoteNumber)
      document.getElementById('quoteNumber').value = saved.quote_number;
    currentStatus = saved.status;
    currentLink   = saved.access_token ? `${location.origin}/quote-view.html?token=${saved.access_token}` : '';
    updateStatusBadge(currentStatus);
    return true;
  } catch (err) {
    console.error('Save error:', err);
    showToast('Save failed — check connection');
    return false;
  }
}

/* ── API Load ── */
async function loadQuoteById(id) {
  showToast('Loading…');
  try {
    const res = await fetch(`/api/quotes/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentQuoteId = data.id;

    document.getElementById('quoteNumber').value    = data.quote_number    || '';
    document.getElementById('quoteName').value      = data.quote_name      || '';
    document.getElementById('dateIssued').value     = data.date_issued     || '';
    document.getElementById('validUntil').value     = data.valid_until     || '';
    document.getElementById('preparedBy').value     = data.prepared_by     || '';
    document.getElementById('contactPerson').value  = data.contact_person  || '';
    document.getElementById('companyName').value    = data.company_name    || '';
    document.getElementById('clientEmail').value    = data.client_email    || '';
    document.getElementById('clientPhone').value    = data.client_phone    || '';
    document.getElementById('clientAddress').value  = data.client_address  || '';
    document.getElementById('websiteUrl').value     = data.website_url     || '';
    document.getElementById('jobSummary').value     = data.job_summary     || '';
    document.getElementById('additionalNotes').value = data.additional_notes || '';

    document.getElementById('lineItemsBody').innerHTML = '';
    (data.line_items || []).forEach(item => addLineItem(item.desc, item.qty, item.rate));
    renderEmptyCheck();
    setDeposit(data.deposit_pct || 60);
    currentStatus = data.status || 'draft';
    currentLink   = data.access_token ? `${location.origin}/quote-view.html?token=${data.access_token}` : '';
    updateStatusBadge(currentStatus);
    document.querySelector('.topbar-title').textContent = 'Edit Quote';
    showToast('✓ Quote loaded');
  } catch (err) {
    console.error('Load error:', err);
    showToast('Could not load quote');
    window.history.replaceState({}, '', 'quotes.html');
    await initBlankQuote();
  }
}

/* ── Status Badge ── */
function updateStatusBadge(status) {
  let badge = document.getElementById('statusBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'statusBadge';
    badge.style.cssText = 'font-size:11px;font-weight:700;padding:3px 9px;border-radius:3px;margin-left:8px;';
    document.querySelector('.topbar-title').after(badge);
  }
  const map = {
    draft:    ['#f4f4f2','#777'],
    published:['#fff4e0','#b46a00'],
    sent:     ['#e0eeff','#1d5bbf'],
    approved: ['#eef7e0','#5c8a1a'],
    invoiced: ['#f0eeff','#6741d9'],
    rejected: ['#fee2e2','#dc2626']
  };
  const [bg, color] = map[status] || map.draft;
  badge.style.background = bg;
  badge.style.color      = color;
  badge.textContent      = status.charAt(0).toUpperCase() + status.slice(1);
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.disabled = !currentLink;
    sendBtn.title = currentLink ? 'Send to the client by email or link' : 'Publish first, then send by email or link';
  }
}

/* ── Button handlers ──
   Save    → stores changes, status unchanged (new quote = Draft). Nothing is sent.
   Publish → saves + creates the client link (Draft → Published). Nothing is sent.
   Send    → only here does the client get it: email, or copy the link yourself. Status → Sent. */
function saveDraft() { saveQuote().then(ok => { if (ok) showToast('✓ Saved'); }); }

async function publishQuote() {
  if (!(await saveQuote())) return;
  try {
    const res = await fetch(`/api/quotes/${currentQuoteId}/publish`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
    const { link, status } = await res.json();
    currentLink = link; currentStatus = status;
    updateStatusBadge(currentStatus);
    showToast('✓ Published — nothing sent. Use Send when ready.');
  } catch (err) {
    console.error('Publish error:', err);
    showToast('Publish failed — check connection');
  }
}

async function openSendModal() {
  if (!currentLink) { showToast('Publish first'); return; }
  if (!(await saveQuote())) return;          // client sees the latest version
  const email = document.getElementById('clientEmail').value.trim();
  document.getElementById('publishLink').value = currentLink;
  const btn = document.getElementById('sendEmailBtn');
  btn.disabled = !email;
  btn.textContent = email ? `Email to ${email}` : 'No client email';
  const status = document.getElementById('publishEmailStatus');
  status.textContent = 'Choose how the client gets it. Saved changes are included.';
  status.style.color = '#777';
  document.getElementById('publishModal').classList.remove('hidden');
}

async function sendQuote(method) {
  const res  = await fetch(`/api/quotes/${currentQuoteId}/send`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  currentStatus = body.status;
  updateStatusBadge(currentStatus);
  return body;
}

async function sendByEmail() {
  const btn = document.getElementById('sendEmailBtn');
  const status = document.getElementById('publishEmailStatus');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const { clientEmail } = await sendQuote('email');
    status.textContent = `✓ Email sent to ${clientEmail}`;
    status.style.color = '#5c8a1a';
    btn.textContent = 'Sent';
  } catch (err) {
    status.textContent = `⚠ ${err.message}`;
    status.style.color = '#b45309';
    btn.disabled = false; btn.textContent = 'Try again';
  }
}

async function sendByLink() {
  const input = document.getElementById('publishLink');
  input.select();
  try { await navigator.clipboard.writeText(input.value); } catch (_) { document.execCommand('copy'); }
  try {
    await sendQuote('link');
    const status = document.getElementById('publishEmailStatus');
    status.textContent = '✓ Link copied — paste it into WhatsApp, email, etc. Marked as Sent.';
    status.style.color = '#5c8a1a';
  } catch (err) { showToast('Link copied, but status not updated'); }
}

function closePublishModal() {
  const m = document.getElementById('publishModal');
  if (m) m.classList.add('hidden');
}

/* ── HTML Generation (opens in new tab, no auto-print) ── */
function generateHTML() {
  const data = collectFormData();
  if (!data.lineItems.length) { alert('Add at least one line item first.'); return; }
  const html = buildQuoteHTML(data, false);
  const win  = window.open('', '_blank', 'width=960,height=760,scrollbars=yes');
  win.document.write(html);
  win.document.close();
}

/* ── PDF Generation (opens in new tab, auto-print) ── */
function generatePDF() {
  const data = collectFormData();
  if (!data.lineItems.length) { alert('Add at least one line item before generating the PDF.'); return; }
  const html = buildQuoteHTML(data, true);
  const win  = window.open('', '_blank', 'width=960,height=760,scrollbars=yes');
  win.document.write(html);
  win.document.close();
}

/* ── Quote HTML builder (shared for PDF and HTML view) ── */
function buildQuoteHTML(d, autoPrint = true) {
  const fmtDate = iso => {
    if (!iso) return '';
    const [y,m,day] = iso.split('-');
    return `${parseInt(day)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]} ${y}`;
  };
  const rows = d.lineItems.map(item => `
    <tr>
      <td>${esc(item.desc)}</td>
      <td class="center">${item.qty}</td>
      <td class="right">${formatR(item.rate)}</td>
      <td class="right">${formatR(item.total)}</td>
    </tr>`).join('');

  const printScript = autoPrint ? `<script>window.onload=()=>setTimeout(()=>window.print(),400);<\/script>` : '';
  const webControls = autoPrint ? '' : `
    <div style="position:sticky;top:0;z-index:100;background:#f8f8f6;border-bottom:1px solid #e8e8e6;padding:10px 48px;display:flex;gap:10px;align-items:center">
      <button onclick="window.print()" style="background:#111;color:white;border:none;padding:9px 18px;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer">Save / Print PDF</button>
      <span style="font-size:12px;color:#aaa">— share this page or save as PDF</span>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${esc(d.quoteNumber)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#111;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:15mm 0}
@media print{.web-only{display:none!important}}
.hdr{background:#111;color:white;padding:36px 48px;display:flex;justify-content:space-between;align-items:flex-start;page-break-inside:avoid}
.logo{display:flex;align-items:center;gap:13px}
.lc{width:46px;height:46px;border-radius:50%;background:#a3c24d;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:21px;color:white}
.ln{font-size:15px;font-weight:700;letter-spacing:.1em;display:block}
.ls{font-size:10px;color:#888;letter-spacing:.06em;display:block;margin-top:3px}
.hr-right{text-align:right}.hr-right h1{font-size:26px;font-weight:800;letter-spacing:.06em}
.hr-right p{font-size:12px;color:#aaa;margin-top:5px}
.accent{height:3px;background:#a3c24d}
.body{padding:36px 48px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:28px;page-break-inside:avoid}
.ib h4{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:10px}
.ib p{font-size:13px;line-height:1.85;color:#333}.ib p strong{color:#111}
.scope{background:#f8f8f6;border-left:3px solid #a3c24d;padding:14px 18px;border-radius:0 5px 5px 0;margin-bottom:28px;page-break-inside:avoid}
.sl{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:6px}
.scope p{font-size:13px;color:#444;line-height:1.6}
.il{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}
thead{page-break-inside:avoid}
th{background:#111;color:white;text-align:left;padding:10px 14px;font-size:10.5px;font-weight:600;letter-spacing:.06em}
th.right,td.right{text-align:right}th.center,td.center{text-align:center}
td{padding:11px 14px;border-bottom:.5px solid #eee;color:#333}
tr{page-break-inside:avoid}
tr:last-child td{border-bottom:none}tr:nth-child(even) td{background:#fafaf8}
td.right{font-weight:600;color:#111}
.totals{display:flex;justify-content:flex-end;margin-bottom:36px;page-break-inside:avoid}
.tbox{width:300px}
.tr{display:flex;justify-content:space-between;font-size:13px;color:#666;padding:8px 0;border-bottom:.5px solid #eee}
.tr:last-child{border-bottom:none}
.grand{font-size:15px;font-weight:700;color:#111;border-top:2px solid #111;border-bottom:2px solid #111;padding:10px 0;margin:4px 0}
.dep{color:#a3c24d;font-weight:600}.bal{color:#555;font-weight:600}
hr{border:none;border-top:.5px solid #e8e8e6;margin:0 0 28px}
.terms-section{page-break-inside:avoid}
.tl{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:14px}
ol{padding-left:18px}
li{font-size:12px;color:#555;line-height:1.75;margin-bottom:4px;page-break-inside:avoid}
.tn{font-size:11.5px;color:#999;font-style:italic;margin-top:12px}
.ag{margin-top:32px;page-break-inside:avoid}
.ag p{font-size:13px;color:#333;margin-bottom:36px}
.sig{display:flex;gap:60px}.sl2{flex:1;border-top:1px solid #aaa;padding-top:8px;font-size:11px;color:#999}
.ftr{background:#111;color:#666;text-align:center;padding:14px;font-size:11px;margin-top:40px;letter-spacing:.03em;page-break-inside:avoid}
.ftr a{color:#a3c24d;text-decoration:none}
</style></head><body>
<div class="web-only">${webControls}</div>
<div class="hdr">
  <div class="logo"><div class="lc">K</div><div><span class="ln">KLIEKNET</span><span class="ls">AI-DRIVEN SOLUTIONS</span></div></div>
  <div class="hr-right">
    <h1>QUOTATION</h1>
    <p>${esc(d.quoteNumber)}</p>
    <p>Issued: ${fmtDate(d.dateIssued)}&nbsp;&nbsp;·&nbsp;&nbsp;Valid until: ${fmtDate(d.validUntil)}</p>
    ${d.preparedBy?`<p style="font-size:11px;color:#bbb;margin-top:4px">Prepared by: ${esc(d.preparedBy)}</p>`:''}
  </div>
</div>
<div class="accent"></div>
<div class="body">
  <div class="meta">
    <div class="ib"><h4>From</h4><p><strong>Klieknet Web Development</strong><br>Stellenbosch Central, South Africa<br>+27 (0)84 9000 193<br>gustav@klieknet.com<br>www.klieknet.com</p></div>
    <div class="ib"><h4>To</h4><p><strong>${esc(d.contactPerson||'—')}</strong>${toLines(d).map(l=>'<br>'+esc(l)).join('')}${d.clientPhone?'<br>'+esc(d.clientPhone):''}${d.clientEmail?'<br>'+esc(d.clientEmail):''}${d.websiteUrl?'<br>'+esc(d.websiteUrl):''}</p></div>
  </div>
  ${d.jobSummary?`<div class="scope"><div class="sl">Scope of Work</div><p>${esc(d.jobSummary)}</p></div>`:''}
  ${d.additionalNotes?`<div class="scope" style="margin-top:16px"><div class="sl">Additional Notes</div><p>${esc(d.additionalNotes)}</p></div>`:''}
  <div class="il">Line Items</div>
  <table>
    <thead><tr><th>Description</th><th class="center">Qty / Hrs</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals"><div class="tbox">
    <div class="tr grand"><span>Grand Total</span><span>${formatR(d.grandTotal)}</span></div>
    <div class="tr dep"><span>Deposit (${d.depositPct}%)</span><span>${formatR(d.depositAmount)}</span></div>
    <div class="tr bal"><span>Balance (${100-d.depositPct}%)</span><span>${formatR(d.balanceAmount)}</span></div>
  </div></div>
  <hr/>
  <div class="terms-section">
    <div class="tl">Terms &amp; Conditions</div>
    <ol>
      <li>A deposit of <strong>${d.depositPct}% of the total quoted amount is due on the day of acceptance.</strong> Upon completion Klieknet will invoice for the balance. The site will not go live until all payments have been received.</li>
      <li>The client is responsible for ALL content (text, images, etc.) required for development, supplied in digital format.</li>
      <li>Once accepted, the client has <strong>two weeks</strong> to supply all content, unless otherwise agreed in writing.</li>
      <li>If the completed site is handed over for review and the client does not supply corrections within <strong>15 working days</strong>, Klieknet will invoice for the full balance.</li>
    </ol>
    <p class="tn">This quotation is valid for four weeks from the date of issue.</p>
  </div>
  <div class="ag">
    <div class="tl">Agreement</div>
    <p>I accept the quotation and hereby give permission to start with the job.</p>
    <div class="sig">
      <div class="sl2">Representative of ${esc(d.companyName||'____________________')}</div>
      <div class="sl2">Date</div>
    </div>
  </div>
</div>
<div class="ftr">Stellenbosch &nbsp;|&nbsp; +27 (0)84 9000 193 &nbsp;|&nbsp; <a href="mailto:info@klieknet.com">info@klieknet.com</a> &nbsp;|&nbsp; <a href="http://www.klieknet.com">www.klieknet.com</a></div>
${printScript}
</body></html>`;
}

/* ── Helpers ── */
// Company + address lines, without repeating the contact or company name
function toLines(d) {
  const norm = x => String(x||'').trim().toLowerCase();
  const seen = new Set([norm(d.contactPerson)]);
  const out = [];
  [d.companyName, ...String(d.clientAddress||'').split('\n')].forEach(l => {
    if (norm(l) && !seen.has(norm(l))) { seen.add(norm(l)); out.push(String(l).trim()); }
  });
  return out;
}
function formatR(n) {
  return 'R' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style,{position:'fixed',bottom:'28px',right:'28px',background:'#111',color:'white',
    padding:'10px 18px',borderRadius:'6px',fontSize:'13px',fontWeight:'600',zIndex:'9999',opacity:'0',transition:'opacity .2s'});
  document.body.appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity='1'; });
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),200); },2400);
}
