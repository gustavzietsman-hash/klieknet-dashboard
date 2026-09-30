/* Opened as a file (file://)? The API only exists on the server — redirect there. */
if (location.protocol === 'file:') {
  const page = location.pathname.split('/').pop() || 'index.html';
  location.replace('http://localhost:3000/' + page + location.search);
}

/* Populates sidebar nav badges on every page */
const SKILLS_MD_URL = 'https://raw.githubusercontent.com/gustavzietsman-hash/klieknet-dashboard/main/SKILLS.md';

function countSkills(md) {
  return (md.match(/^### /gm) || []).length;
}

document.addEventListener('DOMContentLoaded', async () => {
  const [qRes, pRes, sRes, prRes, mdRes] = await Promise.allSettled([
    fetch('/api/quotes'),
    fetch('/api/proposals'),
    fetch(SKILLS_MD_URL, { cache: 'no-cache' }),
    fetch('/api/projects'),
    fetch('/api/mandates'),
  ]);

  if (mdRes.status === 'fulfilled' && mdRes.value.ok) {
    const n = (await mdRes.value.json()).filter(m => m.status === 'received').length;
    document.querySelectorAll('.nav-badge-mandates').forEach(el => { el.textContent = n || ''; });
  }

  if (prRes.status === 'fulfilled' && prRes.value.ok) {
    const n = (await prRes.value.json()).filter(p => p.status !== 'completed' && p.status !== 'cancelled').length;
    document.querySelectorAll('.nav-badge-projects').forEach(el => { el.textContent = n || ''; });
  }

  if (qRes.status === 'fulfilled' && qRes.value.ok) {
    const n = (await qRes.value.json()).length;
    document.querySelectorAll('.nav-badge-quotes').forEach(el => { el.textContent = n || ''; });
  }

  if (pRes.status === 'fulfilled' && pRes.value.ok) {
    const n = (await pRes.value.json()).length;
    document.querySelectorAll('.nav-badge-proposals').forEach(el => { el.textContent = n || ''; });
  }

  if (sRes.status === 'fulfilled' && sRes.value.ok) {
    const n = countSkills(await sRes.value.text());
    document.querySelectorAll('.nav-badge-skills').forEach(el => { el.textContent = n || ''; });
  }
});
