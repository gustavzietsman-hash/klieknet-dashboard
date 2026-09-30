/* ── Debit order mandates page ── */
let allMandates = [];
let editingId = null;
let selectedFile = null;

const STATUS_LABELS = { received: 'To load on Netcash', loaded: 'Loaded on Netcash', cancelled: 'Cancelled' };

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSidebar(); closeUpload(); } });

const $ = id => document.getElementById(id);
function esc(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatR(n) { return n == null || n === '' ? '—' : 'R' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function formatDate(s) { return s ? new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function showToast(msg) {
  const t = document.createElement('div'); t.textContent = msg;
  Object.assign(t.style, { position:'fixed', bottom:'28px', right:'28px', background:'#111', color:'#fff',
    padding:'10px 18px', borderRadius:'6px', fontSize:'13px', fontWeight:'600', zIndex:'9999' });
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}
function docLink(m) {
  if (m.source === 'form') return `<a class="md-doc" href="mandate-view.html?id=${m.id}" target="_blank" rel="noopener">View mandate</a><br><span class="md-src form">Online form</span>`;
  if (m.filepath)          return `<a class="md-doc" href="/api/mandates/${m.id}/file" target="_blank" rel="noopener">${esc(m.filename)}</a><br><span class="md-src">Upload</span>`;
  return '—';
}

/* ── Render ── */
function renderTable(rows) {
  const tbody = $('mandatesBody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <p>${allMandates.length ? 'No mandates match your filter' : 'No mandates yet'}</p>
      ${allMandates.length ? '' : '<button type="button" class="btn-new-quote" onclick="openUpload()">Upload Mandate</button>'}
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(m => `
    <tr>
      <td>
        <div class="qt-client">${esc(m.client_name || '—')}</div>
        ${m.company_name ? `<div class="qt-company">${esc(m.company_name)}</div>` : ''}
      </td>
      <td class="qt-date">${esc(m.reference || '—')}</td>
      <td class="qt-amount">${formatR(m.amount)}</td>
      <td>${docLink(m)}</td>
      <td class="qt-date">${formatDate(m.created_at)}</td>
      <td>
        <select class="md-status-select ${m.status}" onchange="setStatus(${m.id}, this)">
          ${Object.entries(STATUS_LABELS).map(([v, l]) => `<option value="${v}" ${v === m.status ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </td>
      <td style="text-align:right;white-space:nowrap">
        <button type="button" class="action-btn" onclick="openUpload(${m.id})">Edit</button>
        <button type="button" class="action-btn action-delete" onclick="deleteMandate(event, ${m.id}, this)"><span>Delete</span></button>
      </td>
    </tr>`).join('');
}

function updateStats() {
  const active = allMandates.filter(m => m.status !== 'cancelled');
  $('statTotal').textContent    = allMandates.length;
  $('statReceived').textContent = allMandates.filter(m => m.status === 'received').length;
  $('statLoaded').textContent   = allMandates.filter(m => m.status === 'loaded').length;
  $('statValue').textContent    = formatR(active.reduce((s, m) => s + Number(m.amount || 0), 0));
}

function filterTable() {
  const q = $('searchInput').value.toLowerCase();
  const st = $('statusFilter').value;
  renderTable(allMandates.filter(m => {
    const hay = [m.client_name, m.company_name, m.client_email, m.reference, m.filename, m.notes].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!st || m.status === st);
  }));
}

async function loadMandates() {
  try {
    const res = await fetch('/api/mandates');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allMandates = await res.json();
    updateStats(); filterTable();
  } catch (err) {
    $('mandatesBody').innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#c43030;font-size:13px;">Failed to load mandates — is the server running?</td></tr>`;
  }
}

/* ── Status change inline ── */
async function setStatus(id, sel) {
  sel.disabled = true;
  try {
    const res = await fetch(`/api/mandates/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: sel.value }) });
    if (!res.ok) throw new Error();
    const updated = await res.json();
    allMandates = allMandates.map(m => m.id === id ? { ...m, ...updated, form_data: m.form_data } : m);
    sel.className = 'md-status-select ' + sel.value;
    updateStats();
    showToast('✓ ' + STATUS_LABELS[sel.value]);
  } catch (_) { showToast('Could not update status'); }
  sel.disabled = false;
}

/* ── Upload / edit panel ── */
function setFile(file) {
  if (!file) return;
  selectedFile = file;
  $('mdDropLabel').textContent = '📎 ' + file.name;
  $('mdDrop').classList.add('has-file');
}
const drop = () => $('mdDrop');
document.addEventListener('DOMContentLoaded', () => {
  drop().addEventListener('dragover', e => { e.preventDefault(); drop().classList.add('drag-over'); });
  drop().addEventListener('dragleave', () => drop().classList.remove('drag-over'));
  drop().addEventListener('drop', e => { e.preventDefault(); drop().classList.remove('drag-over'); setFile(e.dataTransfer.files[0]); });
});

function openUpload(id = null) {
  editingId = id;
  const m = id ? allMandates.find(x => x.id === id) : null;
  $('mdFormTitle').textContent = m ? 'Edit Mandate' : 'Upload Mandate';
  $('mdClient').value  = m?.client_name ?? '';
  $('mdCompany').value = m?.company_name ?? '';
  $('mdEmail').value   = m?.client_email ?? '';
  $('mdRef').value     = m?.reference ?? '';
  $('mdAmount').value  = m?.amount ?? '';
  $('mdStatus').value  = m?.status ?? 'received';
  $('mdNotes').value   = m?.notes ?? '';
  $('mdFileWrap').style.display = m ? 'none' : '';
  selectedFile = null; $('mdFile').value = '';
  $('mdDropLabel').innerHTML = 'Drop the PDF or photo here, or <u>browse</u>';
  $('mdDrop').classList.remove('has-file');
  $('mandateModal').classList.remove('hidden');
  setTimeout(() => $('mdClient').focus(), 50);
}
function closeUpload() { const m = $('mandateModal'); if (m) m.classList.add('hidden'); editingId = null; }

async function saveMandate(e) {
  e.preventDefault();
  const btn = $('mdSaveBtn');
  if (!editingId && !selectedFile) { showToast('Please attach the signed mandate'); return; }
  btn.disabled = true;
  try {
    let res;
    if (editingId) {
      res = await fetch(`/api/mandates/${editingId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: $('mdClient').value.trim(), company_name: $('mdCompany').value.trim(),
          client_email: $('mdEmail').value.trim(), reference: $('mdRef').value.trim(),
          amount: $('mdAmount').value, status: $('mdStatus').value, notes: $('mdNotes').value,
        }),
      });
    } else {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('client_name', $('mdClient').value.trim());
      fd.append('company_name', $('mdCompany').value.trim());
      fd.append('client_email', $('mdEmail').value.trim());
      fd.append('reference', $('mdRef').value.trim());
      fd.append('amount', $('mdAmount').value);
      fd.append('notes', $('mdNotes').value);
      res = await fetch('/api/mandates', { method: 'POST', body: fd });
    }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    // new uploads can also be saved straight as "loaded"
    if (!editingId && $('mdStatus').value !== 'received') {
      const created = await res.json();
      await fetch(`/api/mandates/${created.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: $('mdStatus').value }) });
    }
    closeUpload(); showToast('✓ Mandate saved'); await loadMandates();
  } catch (err) {
    showToast('Save failed — ' + err.message);
  } finally { btn.disabled = false; }
}

async function deleteMandate(e, id, btn) {
  e.stopPropagation();
  if (!btn.classList.contains('armed')) {
    btn.classList.add('armed'); btn.querySelector('span').textContent = 'Confirm?';
    btn._t = setTimeout(() => { btn.classList.remove('armed'); btn.querySelector('span').textContent = 'Delete'; }, 3000);
    return;
  }
  clearTimeout(btn._t); btn.disabled = true;
  try {
    const res = await fetch(`/api/mandates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    allMandates = allMandates.filter(m => m.id !== id); updateStats(); filterTable();
  } catch (_) { btn.disabled = false; btn.querySelector('span').textContent = 'Failed'; }
}

document.addEventListener('DOMContentLoaded', loadMandates);

/* Copy the public mandate form link for a client */
function copyFormLink(btn) {
  const url = `${location.origin}/mandate.html`;
  navigator.clipboard.writeText(url).then(() => {
    const t = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = t, 1800);
  }).catch(() => prompt('Copy this link:', url));
}
