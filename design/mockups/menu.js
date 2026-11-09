// Mockup only: header dropdown with Escape-to-close.
const btn = document.getElementById('menuBtn'), list = document.getElementById('menuList');
btn.addEventListener('click', () => { const open = btn.getAttribute('aria-expanded') === 'true'; btn.setAttribute('aria-expanded', String(!open)); list.hidden = open; if (!open) list.querySelector('a').focus(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !list.hidden) { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); } });
document.addEventListener('click', e => { if (!e.target.closest('.menu') && !list.hidden) { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
