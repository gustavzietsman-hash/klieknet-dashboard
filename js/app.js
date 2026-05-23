document.querySelectorAll('.nav-item[href="#"]').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSidebar();
});

document.querySelectorAll('.nav-item:not([href="#"])').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth <= 900) closeSidebar();
  });
});

// ── Live Supabase data ───────────────────────────────────────

function formatR(n) {
  return 'R' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatRShort(n) {
  const num = Number(n || 0);
  if (num >= 1000) return 'R' + (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return formatR(num);
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function badgeClass(status) {
  const map = { draft: 'pending', sent: 'pending', approved: 'approved', invoiced: 'approved', rejected: 'rejected' };
  return map[status] || 'pending';
}

function badgeLabel(status) {
  const map = { draft: 'Draft', sent: 'Sent', approved: 'Approved', invoiced: 'Invoiced', rejected: 'Rejected' };
  return map[status] || 'Draft';
}

async function loadDashboard() {
  const { data: quotes, error } = await db
    .from('quotes')
    .select('id, quote_number, contact_person, company_name, grand_total, date_issued, status, created_at')
    .order('created_at', { ascending: false });

  if (error || !quotes) return;

  const now = new Date();
  const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  const pending  = quotes.filter(q => q.status === 'sent').length;
  const approved = quotes.filter(q => q.status === 'approved' || q.status === 'invoiced').length;
  const monthRev = quotes
    .filter(q => (q.date_issued || '').startsWith(thisMonth))
    .reduce((sum, q) => sum + Number(q.grand_total || 0), 0);

  // Update stat cards
  setText('statQuotesVal',   quotes.length);
  setText('statPendingVal',  pending);
  setText('statApprovedVal', approved);
  setText('statRevenueVal',  formatRShort(monthRev));

  // Update recent quotes list
  const list = document.getElementById('recentQuotesList');
  if (!list) return;

  const recent = quotes.slice(0, 5);
  if (!recent.length) {
    list.innerHTML = `<p style="padding:20px;color:#aaa;font-size:13px;text-align:center;">No quotes yet</p>`;
    return;
  }

  list.innerHTML = recent.map(q => {
    const name = q.contact_person || q.company_name || 'Unknown';
    const company = q.company_name && q.contact_person ? q.company_name : '';
    const meta = [company, formatDate(q.date_issued)].filter(Boolean).join(' · ');
    const cls = badgeClass(q.status);
    const lbl = badgeLabel(q.status);

    return `
      <a href="quotes.html?id=${q.id}" class="quote-item" style="text-decoration:none;display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f2f2f0;">
        <div class="item-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.5 1.5H4a.5.5 0 00-.5.5v12a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V4L9.5 1.5z"/>
            <path d="M9.5 1.5V4H12"/>
            <line x1="5.5" y1="7.5" x2="10.5" y2="7.5"/>
            <line x1="5.5" y1="10" x2="8.5" y2="10"/>
          </svg>
        </div>
        <div class="quote-info" style="flex:1;min-width:0;">
          <p class="quote-name">${esc(name)}</p>
          <p class="quote-meta">${esc(meta)}</p>
        </div>
        <div class="quote-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="quote-amount">${formatRShort(q.grand_total)}</span>
          <span class="status-badge ${cls}">${lbl}</span>
        </div>
      </a>`;
  }).join('');

  // Update sidebar badge
  const badge = document.querySelector('.nav-item[href="quotes-list.html"] .nav-badge');
  if (badge) badge.textContent = quotes.length;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

document.addEventListener('DOMContentLoaded', loadDashboard);
