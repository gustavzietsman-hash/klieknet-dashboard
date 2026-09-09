const API = 'http://localhost:3000';
let allContacts = [];
let sortCol = 'lastInteraction';
let sortDir = 'desc';

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function segLabel(seg) {
  const map = { client: 'Client', prospect: 'Prospect', partner: 'Partner', vendor: 'Vendor', untagged: 'Untagged' };
  return map[seg] || 'Untagged';
}

function segClass(seg) {
  return `seg-${seg || 'untagged'}`;
}

function sortContacts(list) {
  return [...list].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (sortCol === 'lastInteraction') {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
    } else if (sortCol === 'contactCount') {
      av = av || 0; bv = bv || 0;
    } else {
      av = (av || '').toLowerCase();
      bv = (bv || '').toLowerCase();
    }
    if (av < bv) return sortDir === 'asc' ? -1 :  1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

function setSort(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortCol = col;
    sortDir = col === 'lastInteraction' || col === 'contactCount' ? 'desc' : 'asc';
  }
  renderHeaders();
  renderTable();
}

function renderHeaders() {
  const cols = [
    { key: 'name',            label: 'Contact',      id: 'th-name' },
    { key: 'segment',         label: 'Segment',      id: 'th-seg' },
    { key: 'lastInteraction', label: 'Last Seen',    id: 'th-last' },
    { key: 'contactCount',    label: 'Interactions', id: 'th-count' },
    { key: 'notes',           label: 'Notes',        id: 'th-notes' },
  ];
  cols.forEach(({ key, label, id }) => {
    const th = document.getElementById(id);
    if (!th) return;
    const arrow = sortCol === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    th.innerHTML = `${label}<span class="sort-arrow">${arrow}</span>`;
    th.classList.toggle('sort-active', sortCol === key);
  });
}

function filterContacts() {
  const q    = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const seg  = document.getElementById('segmentFilter')?.value || '';
  const dmOnly = document.getElementById('dmFilter')?.checked || false;
  return allContacts.filter(c => {
    const matchSeg = !seg    || c.segment === seg;
    const matchQ   = !q      || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
    const matchDM  = !dmOnly || c.directMarketing;
    return matchSeg && matchQ && matchDM;
  });
}

function renderStats() {
  setText('statTotal',     allContacts.length);
  setText('statClients',   allContacts.filter(c => c.segment === 'client').length);
  setText('statProspects', allContacts.filter(c => c.segment === 'prospect').length);
  setText('statPartners',  allContacts.filter(c => c.segment === 'partner').length);
  setText('statApproved',  allContacts.filter(c => c.approved !== 0).length);
}

function renderTable() {
  const tbody    = document.getElementById('contactsBody');
  const filtered = sortContacts(filterContacts());

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><p>No contacts found</p></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const segOpts = ['client','prospect','partner','vendor','untagged']
      .map(s => `<option value="${s}"${c.segment === s ? ' selected' : ''}>${segLabel(s)}</option>`)
      .join('');

    const notesText = c.notes || '';

    return `<tr data-id="${c.id}">
      <td class="col-name">
        <div class="ct-name">${esc(c.name) || '<span style="color:#bbb">—</span>'}</div>
        <div class="ct-email">${esc(c.email)}</div>
      </td>
      <td class="col-seg">
        <select class="seg-select ${segClass(c.segment)}" onchange="saveSegment(${c.id}, this)">
          ${segOpts}
        </select>
      </td>
      <td class="col-last ct-date">${formatDate(c.lastInteraction)}</td>
      <td class="col-count ct-count">${c.contactCount || 0}</td>
      <td class="col-notes notes-cell">
        <div class="notes-display${notesText ? '' : ' empty'}" onclick="editNotes(this, ${c.id})">${esc(notesText) || 'Add note…'}</div>
      </td>
      <td class="col-approved">
        <label class="toggle" title="${c.approved !== 0 ? 'Approved' : 'Denied'}">
          <input type="checkbox" ${c.approved !== 0 ? 'checked' : ''} onchange="toggleApproved(${c.id}, this)">
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </td>
      <td class="col-dm">
        <input type="checkbox" class="dm-checkbox" ${c.directMarketing ? 'checked' : ''} onchange="toggleDM(${c.id}, this)" title="Include in direct marketing" />
      </td>
    </tr>`;
  }).join('');
}

function editNotes(el, id) {
  const current = allContacts.find(c => c.id === id);
  const value   = current?.notes || '';

  const textarea = document.createElement('textarea');
  textarea.className = 'notes-input';
  textarea.value     = value;

  el.replaceWith(textarea);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  function commit() {
    const newVal = textarea.value.trim();
    if (current) current.notes = newVal;

    const display = document.createElement('div');
    display.className  = `notes-display${newVal ? '' : ' empty'}`;
    display.textContent = newVal || 'Add note…';
    display.onclick    = () => editNotes(display, id);
    textarea.replaceWith(display);

    saveNotes(id, newVal);
  }

  textarea.addEventListener('blur', commit);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Escape') { textarea.value = value; textarea.blur(); }
  });
}

async function toggleApproved(id, el) {
  const approved = el.checked ? 1 : 0;
  const contact  = allContacts.find(c => c.id === id);
  if (contact) contact.approved = approved;
  renderStats();

  try {
    await fetch(`${API}/api/contacts/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ approved }),
    });
  } catch (err) {
    console.error('Failed to save approved:', err);
    el.checked = !el.checked;
    if (contact) contact.approved = el.checked ? 1 : 0;
    renderStats();
  }
}

async function toggleDM(id, el) {
  const directMarketing = el.checked ? 1 : 0;
  const contact = allContacts.find(c => c.id === id);
  if (contact) contact.directMarketing = directMarketing;

  try {
    await fetch(`${API}/api/contacts/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ directMarketing }),
    });
  } catch (err) {
    console.error('Failed to save DM flag:', err);
    el.checked = !el.checked;
    if (contact) contact.directMarketing = el.checked ? 1 : 0;
  }
}

function exportDM() {
  const list = allContacts.filter(c => c.directMarketing);
  if (!list.length) {
    alert('No contacts marked for direct marketing. Check the Direct Marketing boxes first.');
    return;
  }

  const headers = ['Name', 'Email', 'Segment', 'Notes'];
  const rows    = list.map(c => [
    c.name  || '',
    c.email || '',
    segLabel(c.segment),
    (c.notes || '').replace(/\n/g, ' '),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `dm-contacts-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveNotes(id, notes) {
  try {
    await fetch(`${API}/api/contacts/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ notes }),
    });
  } catch (err) {
    console.error('Failed to save notes:', err);
  }
}

async function saveSegment(id, selectEl) {
  const segment = selectEl.value;

  // Update colour class
  selectEl.className = `seg-select ${segClass(segment)}`;

  // Update local state
  const c = allContacts.find(c => c.id === id);
  if (c) c.segment = segment;
  renderStats();

  try {
    await fetch(`${API}/api/contacts/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ segment }),
    });
  } catch (err) {
    console.error('Failed to save segment:', err);
  }
}

function exportCSV() {
  const filtered = allContacts.filter(c => c.approved !== 0);
  if (!filtered.length) {
    alert('No approved contacts to export. Toggle the Approved switch on contacts you want to include.');
    return;
  }

  const headers = ['Name', 'Email', 'Segment', 'Last Interaction', 'Interactions', 'Notes'];
  const rows    = filtered.map(c => [
    c.name         || '',
    c.email        || '',
    segLabel(c.segment),
    c.lastInteraction || '',
    c.contactCount || 0,
    (c.notes || '').replace(/\n/g, ' '),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'contacts.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function loadContacts() {
  try {
    const res  = await fetch(`${API}/api/contacts`);
    allContacts = await res.json();
  } catch (_) {
    allContacts = [];
    document.getElementById('contactsBody').innerHTML =
      `<tr><td colspan="5" class="empty-state"><p>Could not connect to backend (localhost:3000)</p></td></tr>`;
    return;
  }
  renderStats();
  renderHeaders();
  renderTable();
}

// ── Sidebar + topbar wiring ───────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

document.addEventListener('DOMContentLoaded', loadContacts);
