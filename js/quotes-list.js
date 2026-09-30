let allQuotes = [];

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

function formatR(n) {
  return 'R' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function badgeHtml(status) {
  const map = {
    draft:    ['draft',    'Draft'],
    published:['published','Published'],
    sent:     ['sent',     'Sent'],
    approved: ['approved', 'Approved'],
    invoiced: ['invoiced', 'Invoiced'],
    rejected: ['rejected', 'Rejected'],
  };
  const [cls, label] = map[status] || ['draft', status || 'Draft'];
  return `<span class="badge badge-${cls}">${label}</span>`;
}

function renderTable(quotes) {
  const tbody = document.getElementById('quotesBody');
  if (!quotes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 16 16" fill="none" stroke="#bbb" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.5 1.5H4a.5.5 0 00-.5.5v12a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V4L9.5 1.5z"/>
              <path d="M9.5 1.5V4H12"/>
            </svg>
            <p>No quotes yet</p>
            <a href="quotes.html" class="btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
              + New Quote
            </a>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = quotes.map(q => {
    const client = q.contact_person || q.company_name || '—';
    const company = (q.contact_person && q.company_name) ? q.company_name : '';
    const amount = formatR(q.grand_total);
    const date = formatDate(q.date_issued);
    const num = q.quote_number || '—';
    const status = q.status || 'draft';

    return `
      <tr onclick="window.location='quotes.html?id=${q.id}'">
        <td><span class="qt-num">${esc(num)}</span></td>
        <td>
          <div class="qt-client">${esc(client)}</div>
          ${company ? `<div class="qt-company">${esc(company)}</div>` : ''}
        </td>
        <td class="qt-amount">${amount}</td>
        <td class="qt-date">${date}</td>
        <td>${badgeHtml(status)}</td>
        <td style="text-align:right">
          <a href="quotes.html?id=${q.id}" class="action-btn" onclick="event.stopPropagation()">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z"/>
            </svg>
            Edit
          </a>
          <a href="projects.html?from_quote=${q.id}" class="action-btn" onclick="event.stopPropagation()" title="Start a project from this quote">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 2v12M2 8h12"/>
            </svg>
            Project
          </a>
          <button type="button" class="action-btn action-delete" onclick="deleteQuote(event, ${q.id}, this)" title="Delete quote">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4"/>
            </svg>
            <span>Delete</span>
          </button>
        </td>
      </tr>`;
  }).join('');
}

/* Two-click delete: first click arms the button, second click (within 3s) deletes */
async function deleteQuote(e, id, btn) {
  e.stopPropagation();
  if (!btn.classList.contains('armed')) {
    btn.classList.add('armed');
    btn.querySelector('span').textContent = 'Confirm?';
    btn._t = setTimeout(() => { btn.classList.remove('armed'); btn.querySelector('span').textContent = 'Delete'; }, 3000);
    return;
  }
  clearTimeout(btn._t);
  btn.disabled = true;
  try {
    const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allQuotes = allQuotes.filter(q => q.id !== id);
    updateStats(allQuotes);
    filterTable();
  } catch (err) {
    console.error('Delete failed:', err.message);
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Failed';
  }
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;

  const filtered = allQuotes.filter(row => {
    const matchesSearch = !q ||
      (row.quote_number || '').toLowerCase().includes(q) ||
      (row.contact_person || '').toLowerCase().includes(q) ||
      (row.company_name || '').toLowerCase().includes(q);
    const matchesStatus = !status || (row.status || 'draft') === status;
    return matchesSearch && matchesStatus;
  });

  renderTable(filtered);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateStats(quotes) {
  const now = new Date();
  const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  const pending  = quotes.filter(q => q.status === 'sent').length;
  const approved = quotes.filter(q => q.status === 'approved' || q.status === 'invoiced').length;
  const monthRev = quotes
    .filter(q => (q.date_issued || '').startsWith(thisMonth) && (q.status === 'approved' || q.status === 'invoiced'))
    .reduce((sum, q) => sum + Number(q.grand_total || 0), 0);

  document.getElementById('statTotal').textContent   = quotes.length;
  document.getElementById('statPending').textContent  = pending;
  document.getElementById('statApproved').textContent = approved;
  document.getElementById('statMonth').textContent    = formatR(monthRev);

  const badge = document.getElementById('navQuoteBadge');
  if (badge) badge.textContent = quotes.length;
}

async function loadQuotes() {
  try {
    const res = await fetch('/api/quotes');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allQuotes = await res.json();
    updateStats(allQuotes);
    renderTable(allQuotes);
  } catch (err) {
    console.error('Failed to load quotes:', err.message);
    document.getElementById('quotesBody').innerHTML =
      `<tr><td colspan="6" style="text-align:center;padding:40px;color:#c43030;font-size:13px;">Failed to load quotes — is the server running?</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', loadQuotes);
