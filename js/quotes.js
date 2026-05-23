/* ── Sidebar (shared) ── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

/* ── State ── */
let depositPct = 60;
let voiceActive = false;
let recognition = null;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');

  document.getElementById('dateIssued').value =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const valid = new Date(now);
  valid.setDate(valid.getDate() + 28);
  document.getElementById('validUntil').value =
    `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}`;

  updateQuoteNumber();
  addLineItem();
  addLineItem();
  addLineItem();

  renderEmptyPlaceholder();
});

/* ── Quote Number ── */
function updateQuoteNumber() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());

  const company = document.getElementById('companyName').value ||
                  document.getElementById('contactPerson').value || '';
  const slug = company
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 20) || 'Client';

  document.getElementById('quoteNumber').value = `QTN${y}_${m}_${d}_${slug}`;
}

/* ── Line Items ── */
function addLineItem(desc = '', qty = 1, rate = 750) {
  const tbody = document.getElementById('lineItemsBody');
  removeEmptyPlaceholder();

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="col-desc">
      <input type="text" class="li-desc" value="${esc(desc)}"
             placeholder="Description of work" oninput="calculateTotals()" />
    </td>
    <td class="col-qty">
      <input type="number" class="li-qty" value="${qty}"
             min="0" step="0.5" oninput="calculateTotals()" />
    </td>
    <td class="col-rate">
      <input type="number" class="li-rate" value="${rate}"
             min="0" step="50" oninput="calculateTotals()" />
    </td>
    <td class="col-total li-total-cell">${formatR(qty * rate)}</td>
    <td class="col-del">
      <button type="button" class="btn-del" onclick="removeRow(this)" title="Remove">&#x2715;</button>
    </td>`;

  tbody.appendChild(tr);
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
  if (document.getElementById('lineItemsBody').children.length === 0) {
    renderEmptyPlaceholder();
  }
  calculateTotals();
}

function renderEmptyPlaceholder() {
  const tbody = document.getElementById('lineItemsBody');
  if (tbody.querySelector('.empty-items')) return;
  const tr = document.createElement('tr');
  tr.className = 'empty-row';
  tr.innerHTML = `<td colspan="5" class="empty-items">
    No line items yet — use Quick Add, Add Row, or Voice Input above.
  </td>`;
  tbody.appendChild(tr);
}

function removeEmptyPlaceholder() {
  const empty = document.querySelector('.empty-row');
  if (empty) empty.remove();
}

/* ── Totals ── */
function calculateTotals() {
  let subtotal = 0;

  document.querySelectorAll('#lineItemsBody tr:not(.empty-row)').forEach(row => {
    const qty  = parseFloat(row.querySelector('.li-qty')?.value) || 0;
    const rate = parseFloat(row.querySelector('.li-rate')?.value) || 0;
    const total = qty * rate;
    const cell = row.querySelector('.li-total-cell');
    if (cell) cell.textContent = formatR(total);
    subtotal += total;
  });

  const deposit = subtotal * depositPct / 100;
  const balance = subtotal - deposit;

  document.getElementById('subtotal').textContent     = formatR(subtotal);
  document.getElementById('grandTotal').textContent   = formatR(subtotal);
  document.getElementById('depositAmount').textContent = formatR(deposit);
  document.getElementById('balanceAmount').textContent = formatR(balance);
  document.getElementById('depositLabel').textContent  = `Deposit (${depositPct}%)`;
  document.getElementById('balanceLabel').textContent  = `Balance (${100 - depositPct}%)`;
}

function setDeposit(pct) {
  depositPct = pct;
  document.querySelectorAll('.deposit-opt').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.pct) === pct);
  });
  calculateTotals();
}

/* ── Voice Input ── */
function toggleVoice() {
  if (voiceActive) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('Voice input requires Chrome or Edge. Firefox does not support it yet.');
    return;
  }

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

  recognition.onresult = e => {
    const text = e.results[0][0].transcript;
    parseVoiceInput(text);
  };

  recognition.onerror = e => {
    console.warn('Voice error:', e.error);
    stopVoice();
  };

  recognition.onend = () => stopVoice();

  recognition.start();
}

function stopVoice() {
  voiceActive = false;
  if (recognition) { try { recognition.abort(); } catch (_) {} }

  const btn = document.getElementById('voiceBtn');
  btn.classList.remove('listening');
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="1" width="6" height="9" rx="3"/>
    <path d="M2 8a6 6 0 0012 0"/><line x1="8" y1="14" x2="8" y2="16"/>
  </svg> Voice`;
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

  Object.entries(WORD_NUMS).forEach(([word, num]) => {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), String(num));
  });

  let hours = 1;
  let rate  = 750;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (hoursMatch) {
    hours = parseFloat(hoursMatch[1]);
    text  = text.replace(hoursMatch[0], '');
  }

  const rateMatch = text.match(/(?:r|@|at|rand)?\s*(\d{3,}(?:\s*\d{3})*)\s*(?:rand|per\s*hour|p\.?h\.?)?/i);
  if (rateMatch) {
    const candidate = parseFloat(rateMatch[1].replace(/\s/g, ''));
    if (candidate >= 100) {
      rate = candidate;
      text = text.replace(rateMatch[0], '');
    }
  }

  let desc = text
    .replace(/[,\.]+$/g, '')
    .replace(/^\s*[-,at@]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  if (!desc) desc = 'New item';

  addLineItem(desc, hours, rate);
}

/* ── Save / Load Draft ── */
function collectFormData() {
  const rows = [];
  document.querySelectorAll('#lineItemsBody tr:not(.empty-row)').forEach(row => {
    const qty  = parseFloat(row.querySelector('.li-qty')?.value) || 0;
    const rate = parseFloat(row.querySelector('.li-rate')?.value) || 0;
    rows.push({
      desc: row.querySelector('.li-desc')?.value || '',
      qty,
      rate,
      total: qty * rate
    });
  });

  const subtotal = rows.reduce((s, r) => s + r.total, 0);
  const deposit  = subtotal * depositPct / 100;

  return {
    quoteNumber:     document.getElementById('quoteNumber').value,
    dateIssued:      document.getElementById('dateIssued').value,
    validUntil:      document.getElementById('validUntil').value,
    contactPerson:   document.getElementById('contactPerson').value,
    companyName:     document.getElementById('companyName').value,
    clientEmail:     document.getElementById('clientEmail').value,
    clientPhone:     document.getElementById('clientPhone').value,
    websiteUrl:      document.getElementById('websiteUrl').value,
    jobSummary:      document.getElementById('jobSummary').value,
    additionalNotes: document.getElementById('additionalNotes').value,
    lineItems:       rows,
    depositPct,
    subtotal,
    grandTotal:    subtotal,
    depositAmount: deposit,
    balanceAmount: subtotal - deposit
  };
}

function saveDraft() {
  localStorage.setItem('klieknet_draft_quote', JSON.stringify(collectFormData()));
  showToast('Draft saved');
}

function loadDraft() {
  const raw = localStorage.getItem('klieknet_draft_quote');
  if (!raw) { showToast('No draft found'); return; }
  const d = JSON.parse(raw);

  document.getElementById('quoteNumber').value   = d.quoteNumber   || '';
  document.getElementById('dateIssued').value     = d.dateIssued    || '';
  document.getElementById('validUntil').value     = d.validUntil    || '';
  document.getElementById('contactPerson').value  = d.contactPerson || '';
  document.getElementById('companyName').value    = d.companyName   || '';
  document.getElementById('clientEmail').value    = d.clientEmail   || '';
  document.getElementById('clientPhone').value    = d.clientPhone   || '';
  document.getElementById('websiteUrl').value     = d.websiteUrl    || '';
  document.getElementById('jobSummary').value     = d.jobSummary    || '';
  document.getElementById('additionalNotes').value= d.additionalNotes || '';

  document.getElementById('lineItemsBody').innerHTML = '';
  (d.lineItems || []).forEach(item => addLineItem(item.desc, item.qty, item.rate));
  if (!d.lineItems?.length) renderEmptyPlaceholder();

  setDeposit(d.depositPct || 60);
  showToast('Draft loaded');
}

/* ── PDF Generation ── */
function generatePDF() {
  const data = collectFormData();

  if (!data.lineItems.length) {
    alert('Add at least one line item before generating the PDF.');
    return;
  }

  const html = buildPrintHTML(data);
  const win  = window.open('', '_blank', 'width=960,height=760,scrollbars=yes');
  win.document.write(html);
  win.document.close();
}

function buildPrintHTML(d) {
  const fmtDate = iso => {
    if (!iso) return '';
    const [y, m, day] = iso.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
  };

  const rows = d.lineItems.map((item, i) => `
    <tr>
      <td>${esc(item.desc)}</td>
      <td class="center">${item.qty}</td>
      <td class="right">${formatR(item.rate)}</td>
      <td class="right">${formatR(item.total)}</td>
    </tr>`).join('');

  const scopeBlock = d.jobSummary ? `
    <div class="pdf-scope">
      <div class="pdf-scope-label">Scope of Work</div>
      <p>${esc(d.jobSummary)}</p>
    </div>` : '';

  const notesBlock = d.additionalNotes ? `
    <div class="pdf-scope" style="margin-top:16px">
      <div class="pdf-scope-label">Additional Notes</div>
      <p>${esc(d.additionalNotes)}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(d.quoteNumber)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#111;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:0}
.pdf-header{background:#111;color:white;padding:38px 48px;display:flex;justify-content:space-between;align-items:flex-start}
.pdf-logo{display:flex;align-items:center;gap:13px}
.pdf-logo-circle{width:46px;height:46px;border-radius:50%;background:#a3c24d;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:21px;color:white;flex-shrink:0}
.pdf-logo-name{font-size:15px;font-weight:700;letter-spacing:.1em;display:block}
.pdf-logo-sub{font-size:10px;color:#888;letter-spacing:.06em;display:block;margin-top:3px}
.pdf-header-right{text-align:right}
.pdf-header-right h1{font-size:26px;font-weight:800;letter-spacing:.06em}
.pdf-header-right p{font-size:12px;color:#aaa;margin-top:5px}
.pdf-accent{height:3px;background:#a3c24d}
.pdf-body{padding:38px 48px}
.pdf-meta{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:30px}
.pdf-info-block h4{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:10px}
.pdf-info-block p{font-size:13px;line-height:1.85;color:#333}
.pdf-info-block p strong{color:#111}
.pdf-scope{background:#f8f8f6;border-left:3px solid #a3c24d;padding:14px 18px;border-radius:0 5px 5px 0;margin-bottom:28px}
.pdf-scope-label{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:6px}
.pdf-scope p{font-size:13px;color:#444;line-height:1.6}
.pdf-items-label{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:14px}
.pdf-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}
.pdf-table th{background:#111;color:white;text-align:left;padding:10px 14px;font-size:10.5px;font-weight:600;letter-spacing:.06em}
.pdf-table th.right{text-align:right}
.pdf-table th.center{text-align:center}
.pdf-table td{padding:11px 14px;border-bottom:.5px solid #eee;color:#333}
.pdf-table tr:last-child td{border-bottom:none}
.pdf-table tr:nth-child(even) td{background:#fafaf8}
.pdf-table td.center{text-align:center}
.pdf-table td.right{text-align:right;font-weight:600;color:#111}
.pdf-totals{display:flex;justify-content:flex-end;margin-bottom:36px}
.pdf-totals-box{width:300px}
.pdf-totals-row{display:flex;justify-content:space-between;font-size:13px;color:#666;padding:8px 0;border-bottom:.5px solid #eee}
.pdf-totals-row:last-child{border-bottom:none}
.pdf-totals-grand{font-size:15px;font-weight:700;color:#111;border-top:2px solid #111;border-bottom:2px solid #111;padding:10px 0;margin:4px 0}
.pdf-totals-deposit{color:#a3c24d;font-weight:600}
.pdf-totals-balance{color:#555;font-weight:600}
.pdf-divider{border:none;border-top:.5px solid #e8e8e6;margin:0 0 28px}
.pdf-section-label{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#a3c24d;margin-bottom:14px}
.pdf-terms ol{padding-left:18px}
.pdf-terms li{font-size:12px;color:#555;line-height:1.75;margin-bottom:4px}
.pdf-terms-note{font-size:11.5px;color:#999;font-style:italic;margin-top:12px}
.pdf-agreement{margin-top:32px}
.pdf-agreement p{font-size:13px;color:#333;margin-bottom:36px}
.pdf-sig-line{display:flex;gap:60px}
.pdf-sig{flex:1;border-top:1px solid #aaa;padding-top:8px;font-size:11px;color:#999}
.pdf-footer{background:#111;color:#666;text-align:center;padding:14px;font-size:11px;margin-top:40px;letter-spacing:.03em}
.pdf-footer a{color:#a3c24d;text-decoration:none}
</style>
</head>
<body>

<div class="pdf-header">
  <div class="pdf-logo">
    <div class="pdf-logo-circle">K</div>
    <div>
      <span class="pdf-logo-name">KLIEKNET</span>
      <span class="pdf-logo-sub">AI-DRIVEN SOLUTIONS</span>
    </div>
  </div>
  <div class="pdf-header-right">
    <h1>QUOTATION</h1>
    <p>${esc(d.quoteNumber)}</p>
    <p>Issued: ${fmtDate(d.dateIssued)}&nbsp;&nbsp;·&nbsp;&nbsp;Valid until: ${fmtDate(d.validUntil)}</p>
  </div>
</div>
<div class="pdf-accent"></div>

<div class="pdf-body">

  <div class="pdf-meta">
    <div class="pdf-info-block">
      <h4>From</h4>
      <p>
        <strong>Klieknet Web Development</strong><br>
        Stellenbosch Central, South Africa<br>
        +27 (0)84 9000 193<br>
        gustav@klieknet.com<br>
        www.klieknet.com
      </p>
    </div>
    <div class="pdf-info-block">
      <h4>To</h4>
      <p>
        <strong>${esc(d.contactPerson || '—')}</strong><br>
        ${esc(d.companyName || '')}<br>
        ${esc(d.clientPhone || '')}<br>
        ${esc(d.clientEmail || '')}<br>
        ${esc(d.websiteUrl || '')}
      </p>
    </div>
  </div>

  ${scopeBlock}
  ${notesBlock}

  <div class="pdf-items-label">Line Items</div>
  <table class="pdf-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="center">Qty / Hrs</th>
        <th class="right">Unit Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="pdf-totals">
    <div class="pdf-totals-box">
      <div class="pdf-totals-row pdf-totals-grand">
        <span>Grand Total</span><span>${formatR(d.grandTotal)}</span>
      </div>
      <div class="pdf-totals-row pdf-totals-deposit">
        <span>Deposit (${d.depositPct}%)</span><span>${formatR(d.depositAmount)}</span>
      </div>
      <div class="pdf-totals-row pdf-totals-balance">
        <span>Balance (${100 - d.depositPct}%)</span><span>${formatR(d.balanceAmount)}</span>
      </div>
    </div>
  </div>

  <hr class="pdf-divider"/>

  <div class="pdf-terms">
    <div class="pdf-section-label">Terms &amp; Conditions</div>
    <ol>
      <li>A deposit of <strong>${d.depositPct}% of the total quoted amount is due on the day of acceptance.</strong> Upon completion Klieknet will invoice for the balance. The site will not go live until all payments have been received.</li>
      <li>The client is responsible for ALL content (text, images, etc.) required for development. Content must be supplied in digital format.</li>
      <li>Once the quote is accepted and generic development is complete, the client has <strong>two weeks</strong> to supply all necessary content, unless otherwise agreed in writing.</li>
      <li>If the completed site is handed over for review and the client does not supply all corrections within <strong>15 working days</strong>, Klieknet will invoice for the balance of the total amount.</li>
    </ol>
    <p class="pdf-terms-note">This quotation is valid for four weeks from the date of issue and will need to be reconfirmed thereafter.</p>
  </div>

  <div class="pdf-agreement">
    <div class="pdf-section-label">Agreement</div>
    <p>I accept the quotation and hereby give permission to start with the job.</p>
    <div class="pdf-sig-line">
      <div class="pdf-sig">Representative of ${esc(d.companyName || '____________________')}</div>
      <div class="pdf-sig">Date</div>
    </div>
  </div>

</div>

<div class="pdf-footer">
  Stellenbosch &nbsp;|&nbsp; +27 (0)84 9000 193 &nbsp;|&nbsp;
  <a href="mailto:info@klieknet.com">info@klieknet.com</a> &nbsp;|&nbsp;
  <a href="http://www.klieknet.com">www.klieknet.com</a>
</div>

<script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
</body>
</html>`;
}

/* ── Helpers ── */
function formatR(n) {
  return 'R' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'28px', right:'28px', background:'#111', color:'white',
    padding:'10px 18px', borderRadius:'6px', fontSize:'13px', fontWeight:'600',
    zIndex:'9999', opacity:'0', transition:'opacity .2s'
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 200);
  }, 2200);
}
