/* ── Projects page ── */
let allProjects = [];
let allQuotesForLink = [];
let editingId = null;

const STATUS_LABELS = {
  planned: 'Planned', in_progress: 'In progress', on_hold: 'On hold',
  review: 'Client review', completed: 'Completed', cancelled: 'Cancelled',
};

/* Sidebar (shared pattern) */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSidebar(); closeProjectForm(); } });

/* Helpers */
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatR(n) { return 'R' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function formatDate(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayISO() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isOpen(p)    { return p.status !== 'completed' && p.status !== 'cancelled'; }
function isOverdue(p) { return isOpen(p) && p.due_date && p.due_date < todayISO(); }
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, { position:'fixed', bottom:'28px', right:'28px', background:'#111', color:'#fff',
    padding:'10px 18px', borderRadius:'6px', fontSize:'13px', fontWeight:'600', zIndex:'9999' });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

/* ── Render ── */
function renderTable(rows) {
  const tbody = document.getElementById('projectsBody');
  if (!rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <p>${allProjects.length ? 'No projects match your filter' : 'No projects yet'}</p>
          ${allProjects.length ? '' : '<button type="button" class="btn-new-quote" onclick="openProjectForm()">+ New Project</button>'}
        </div>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => {
    const client  = p.contact_person || p.company_name || '—';
    const company = (p.contact_person && p.company_name) ? p.company_name : '';
    const overdue = isOverdue(p);
    return `
      <tr onclick="openProjectForm(${p.id})">
        <td>
          <div class="qt-client">${esc(p.name)}</div>
          ${p.quote_number ? `<div class="qt-company">Quote ${esc(p.quote_number)}</div>` : ''}
        </td>
        <td>
          <div class="qt-client">${esc(client)}</div>
          ${company ? `<div class="qt-company">${esc(company)}</div>` : ''}
        </td>
        <td class="qt-amount">${formatR(p.value)}</td>
        <td class="qt-date ${overdue ? 'pj-overdue' : ''}">${formatDate(p.due_date)}${overdue ? '<div class="pj-overdue-tag">Overdue</div>' : ''}</td>
        <td>
          <div class="pj-progress"><div class="pj-progress-bar" style="width:${p.progress}%"></div></div>
          <div class="pj-progress-num">${p.progress}%</div>
        </td>
        <td><span class="badge pj-badge-${p.status}">${STATUS_LABELS[p.status] || p.status}</span></td>
        <td style="text-align:right;white-space:nowrap">
          <button type="button" class="action-btn" onclick="event.stopPropagation();openProjectForm(${p.id})">Edit</button>
          <button type="button" class="action-btn action-delete" onclick="deleteProject(event, ${p.id}, this)"><span>Delete</span></button>
        </td>
      </tr>`;
  }).join('');
}

function updateStats() {
  const open = allProjects.filter(isOpen);
  document.getElementById('statActive').textContent    = open.length;
  document.getElementById('statOverdue').textContent   = allProjects.filter(isOverdue).length;
  document.getElementById('statCompleted').textContent = allProjects.filter(p => p.status === 'completed').length;
  document.getElementById('statValue').textContent     = formatR(open.reduce((s, p) => s + Number(p.value || 0), 0));
}

function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  renderTable(allProjects.filter(p => {
    const hay = [p.name, p.contact_person, p.company_name, p.quote_number, p.notes].join(' ').toLowerCase();
    const okSearch = !q || hay.includes(q);
    const okStatus = !status || (status === 'active' ? isOpen(p) : p.status === status);
    return okSearch && okStatus;
  }));
}

/* ── Load ── */
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProjects = await res.json();
    updateStats();
    filterTable();
  } catch (err) {
    console.error('Failed to load projects:', err.message);
    document.getElementById('projectsBody').innerHTML =
      `<tr><td colspan="7" style="text-align:center;padding:40px;color:#c43030;font-size:13px;">Failed to load projects — is the server running?</td></tr>`;
  }
}

async function loadQuotesForLink() {
  try {
    const res = await fetch('/api/quotes');
    if (!res.ok) return;
    allQuotesForLink = await res.json();
    const sel = document.getElementById('pjQuote');
    sel.innerHTML = '<option value="">— No linked quote —</option>' + allQuotesForLink.map(q =>
      `<option value="${q.id}">${esc(q.quote_number || 'Quote #' + q.id)} — ${esc(q.company_name || q.contact_person || '')} (${formatR(q.grand_total)})</option>`
    ).join('');
  } catch (_) {}
}

/* ── Form ── */
const $ = id => document.getElementById(id);
function syncProgress() { $('pjProgressLabel').textContent = $('pjProgress').value + '%'; }

function fillFromQuote() {
  const q = allQuotesForLink.find(x => String(x.id) === $('pjQuote').value);
  if (!q) return;
  if (!$('pjName').value)    $('pjName').value    = q.quote_name || q.job_summary?.slice(0, 60) || q.company_name || '';
  $('pjContact').value = q.contact_person || $('pjContact').value;
  $('pjCompany').value = q.company_name   || $('pjCompany').value;
  $('pjEmail').value   = q.client_email   || $('pjEmail').value;
  $('pjWebsite').value = q.website_url    || $('pjWebsite').value;
  if (!Number($('pjValue').value)) $('pjValue').value = q.grand_total || 0;
  if (!$('pjNotes').value && q.job_summary) $('pjNotes').value = q.job_summary;
}

function openProjectForm(id = null, fromQuoteId = null) {
  editingId = id;
  const p = id ? allProjects.find(x => x.id === id) : null;
  $('pjFormTitle').textContent = p ? 'Edit Project' : 'New Project';
  $('pjQuote').value   = p?.quote_id ?? '';
  $('pjName').value    = p?.name ?? '';
  $('pjContact').value = p?.contact_person ?? '';
  $('pjCompany').value = p?.company_name ?? '';
  $('pjEmail').value   = p?.client_email ?? '';
  $('pjWebsite').value = p?.website_url ?? '';
  $('pjStatus').value  = p?.status ?? 'planned';
  $('pjValue').value   = p?.value ?? 0;
  $('pjStart').value   = p?.start_date ?? (p ? '' : todayISO());
  $('pjDue').value     = p?.due_date ?? '';
  $('pjProgress').value = p?.progress ?? 0;
  $('pjNotes').value   = p?.notes ?? '';
  syncProgress();
  if (!p && fromQuoteId) { $('pjQuote').value = String(fromQuoteId); fillFromQuote(); }
  $('projectModal').classList.remove('hidden');
  setTimeout(() => $('pjName').focus(), 50);
}

function closeProjectForm() {
  const m = document.getElementById('projectModal');
  if (m) m.classList.add('hidden');
  editingId = null;
}

async function saveProject(e) {
  e.preventDefault();
  const btn = $('pjSaveBtn');
  btn.disabled = true;
  const payload = {
    name: $('pjName').value.trim(),
    quote_id: $('pjQuote').value || null,
    contact_person: $('pjContact').value.trim(),
    company_name: $('pjCompany').value.trim(),
    client_email: $('pjEmail').value.trim(),
    website_url: $('pjWebsite').value.trim(),
    status: $('pjStatus').value,
    value: Number($('pjValue').value) || 0,
    start_date: $('pjStart').value || null,
    due_date: $('pjDue').value || null,
    progress: Number($('pjProgress').value) || 0,
    notes: $('pjNotes').value,
  };
  try {
    const res = await fetch(editingId ? `/api/projects/${editingId}` : '/api/projects', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    closeProjectForm();
    showToast('✓ Project saved');
    await loadProjects();
  } catch (err) {
    console.error('Save project failed:', err.message);
    showToast('Save failed — ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

/* Two-click delete, same as quotes */
async function deleteProject(e, id, btn) {
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
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProjects = allProjects.filter(p => p.id !== id);
    updateStats();
    filterTable();
  } catch (err) {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Failed';
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadProjects(), loadQuotesForLink()]);
  const fromQuote = new URLSearchParams(location.search).get('from_quote');
  if (fromQuote) {
    openProjectForm(null, fromQuote);
    history.replaceState({}, '', 'projects.html');
  }
});
