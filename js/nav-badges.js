/* Populates sidebar nav badges on every page */
const SKILLS_MD_URL = 'https://raw.githubusercontent.com/gustavzietsman-hash/klieknet-dashboard/main/SKILLS.md';

function countSkills(md) {
  return (md.match(/^### /gm) || []).length;
}

document.addEventListener('DOMContentLoaded', async () => {
  const [qRes, pRes, sRes] = await Promise.allSettled([
    fetch('/api/quotes'),
    fetch('/api/proposals'),
    fetch(SKILLS_MD_URL, { cache: 'no-cache' }),
  ]);

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
