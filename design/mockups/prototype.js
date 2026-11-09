// Clickable prototype: sample data only, no network. State persists in localStorage until "Reset".
const KEY = 'sprout-proto';
const state = Object.assign({ hidden: {}, fits: {}, added: [], checked: {}, watchHidden: {}, admin: {}, sources: [] }, JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const page = location.pathname.split('/').pop().replace('.html', '') || 'today';
const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ── Toast with optional Undo ──
let toastTimer;
function toast(msg, undo) {
  $('.toast')?.remove(); clearTimeout(toastTimer);
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.textContent = msg;
  if (undo) { const b = document.createElement('button'); b.textContent = 'Undo'; b.onclick = () => { undo(); t.remove(); }; t.append(b); }
  document.body.append(t); toastTimer = setTimeout(() => t.remove(), 5000);
}

// ── Prototype badge + reset ──
const note = document.createElement('div'); note.className = 'proto-note';
note.innerHTML = 'Prototype · sample data · <button type="button">Reset</button>';
note.querySelector('button').onclick = () => { localStorage.removeItem(KEY); location.reload(); };
document.body.append(note);

// ── Dialog helper ──
function dialog(html) {
  const d = document.createElement('dialog'); d.innerHTML = `<div class="dlg">${html}</div>`;
  document.body.append(d); d.addEventListener('close', () => d.remove());
  d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close());
  d.showModal(); return d;
}

// ── Add a job (header, every page) ──
const companies = ['Lumen Health', 'Quarry AI', 'Northfield Bio', 'Meridian Health System', 'Atlas Payments', 'Fernwood Clinics'];
function openAddJob() {
  const d = dialog(`<h2>Add a job</h2>
    <label for="aj-co">Company</label><input id="aj-co" list="aj-list" placeholder="Start typing a company"><datalist id="aj-list">${companies.map(c => `<option value="${c}">`).join('')}</datalist>
    <label for="aj-title">Job title</label><input id="aj-title" placeholder="e.g. Fractional Head of Product">
    <label for="aj-link">Link (optional)</label><input id="aj-link" placeholder="Greenhouse, Lever, or Ashby links fill in the details">
    <label for="aj-via">Where I found it</label><select id="aj-via"><option>VentureFizz</option><option>Health Tech Nerds</option><option>Other</option></select>
    <label for="aj-desc">Job description</label><textarea id="aj-desc" placeholder="Paste the posting text so Check fit can use it"></textarea>
    <div class="foot"><button class="btn quiet" data-close>Cancel</button><button class="btn solid" id="aj-save">Add job</button></div>`);
  $('#aj-link', d).addEventListener('input', e => {
    if (/linkedin\.com/i.test(e.target.value)) e.target.setCustomValidity('LinkedIn links are saved but never opened by the app. Paste the job text below.'), e.target.reportValidity(); else e.target.setCustomValidity('');
  });
  $('#aj-save', d).onclick = () => {
    const company = $('#aj-co', d).value.trim(), title = $('#aj-title', d).value.trim();
    if (!company || !title) { toast('Add a company and a job title.'); return; }
    state.added.unshift({ company, title, via: $('#aj-via', d).value }); save(); d.close();
    if (page === 'today') renderAdded(); toast(`${title} at ${company} added to Today.`);
  };
}

// ── Today ──
function updateLeadCount() {
  const n = $$('.card').filter(c => c.style.display !== 'none').length;
  const h = $('#leads'); if (h) h.textContent = n ? `${n} new lead${n === 1 ? '' : 's'}` : 'No new leads';
  const sub = h?.nextElementSibling; if (sub) sub.textContent = n ? 'newest job first' : 'No new openings at companies you know. Last checked 7:42 AM.';
}
function hideCard(card, kind) {
  const name = $('h3', card).textContent;
  card.classList.add('leaving');
  setTimeout(() => { card.style.display = 'none'; card.classList.remove('leaving'); updateLeadCount(); }, 250);
  state.hidden[name] = kind; save();
  toast(kind === 'reviewed' ? `${name} reviewed. It comes back when a new role opens.` : `${name} excluded. Include it again from Admin.`, () => {
    delete state.hidden[name]; save(); card.style.display = ''; updateLeadCount();
  });
}
const FITS = {
  default: { grade: 'Strong fit', matches: [['Platform and data architecture', 'experience turning complex data systems into product infrastructure'], ['Healthcare background', 'prior experience in digital health or regulated environments']], gaps: ['Payer contracting experience is asked for and not on your profile'] },
};
function showFit(job, animate) {
  const title = $('.job-title', job).childNodes[0].textContent.trim();
  const f = FITS[title] || FITS.default;
  const box = document.createElement('div'); box.className = 'fit';
  box.innerHTML = `<span class="grade">${f.grade}</span> <span class="k">· checked ${today} · ~1¢</span>
    <ul>${f.matches.map(([r, q]) => `<li>${r}: <q>${q}</q></li>`).join('')}</ul>
    <div class="k" style="margin-top:.4rem">Gap: ${f.gaps.join(' · ')}</div>`;
  const btn = $$('.btn', job).find(b => b.textContent.startsWith('Check'));
  if (animate) { btn.textContent = 'Checking…'; btn.disabled = true; }
  setTimeout(() => { job.append(box); btn.textContent = 'Fit checked'; btn.disabled = true; }, animate ? 900 : 0);
  state.fits[title] = true; save();
}
function openCoverLetter(card, job) {
  const company = $('h3', card).textContent, role = $('.job-title', job).childNodes[0].textContent.trim();
  const people = $$('.who', card).map(p => p.textContent);
  const d = dialog(`<h2>Cover letter · ${role}</h2>
    <label>Opening</label><div class="choice"><label><input type="radio" name="op" value="std" checked> Standard</label><label><input type="radio" name="op" value="mis"> Mission-driven</label></div>
    <label for="cl-ref">Referrer (optional)</label><select id="cl-ref"><option value="">No referrer</option>${people.map(p => `<option>${p}</option>`).join('')}</select>
    <label for="cl-note">Why this company (optional)</label><input id="cl-note" placeholder="Anything the job description won't tell it">
    <div class="foot"><button class="btn quiet" data-close>Cancel</button><button class="btn solid" id="cl-go">Draft letter · ~2¢</button></div>`);
  $('#cl-go', d).onclick = () => {
    const ref = $('#cl-ref', d).value; const btn = $('#cl-go', d); btn.textContent = 'Drafting…'; btn.disabled = true;
    setTimeout(() => {
      const p1 = `I am a software engineer turned product manager. My focus is on turning complex data and system architecture into scalable product infrastructure while building hands-on alongside engineering teams.${ref ? ` ${ref} recommended I reach out regarding this role, and I was eager to connect.` : ''}`;
      const p2 = `At Northwind Labs, I lead technical product strategy for clinical data pipelines, consolidating fragmented tools into one platform. At Bluebird Care, I directed enterprise product initiatives for a conversational AI service, balancing clinical safety with the core user experience. Earlier in my career, I architected identity and platform systems at Kestrel and Maple Grid, translating complex backends into reliable user workflows.`;
      const p3 = `I build with AI tools daily, and I bring deep experience in platform architecture, technical specifications, and shipping enterprise software. I would welcome the chance to discuss how my engineering foundation can support <span class="flagged" title="Not found in the job description: check this">${company}'s remote monitoring roadmap</span>.`;
      const words = t => t.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
      d.querySelector('.dlg').innerHTML = `<h2>Draft · ${role}</h2>
        <div class="letter" contenteditable="true" aria-label="Editable cover letter">Dear ${company},\n\n${p1}\n\n${p2}\n\n${p3}\n\nBest,\nYour Full Name</div>
        <div class="counts">Words per paragraph: ${words(p1)} / ${words(p2)} / ${words(p3)} · caps ${ref ? 43 : 28} / 81 / 40 · highlighted text couldn't be verified</div>
        <div class="foot"><button class="btn quiet" data-close>Close</button><button class="btn" id="cl-regen">Regenerate (2 left)</button><button class="btn solid" id="cl-copy">Copy</button></div>`;
      d.querySelectorAll('[data-close]').forEach(b => b.onclick = () => d.close());
      $('#cl-copy', d).onclick = () => { navigator.clipboard?.writeText($('.letter', d).innerText); toast('Cover letter copied.'); };
      $('#cl-regen', d).onclick = () => toast('In the real app this redrafts, up to 3 times per job.');
    }, 1100);
  };
}
function renderAdded() {
  $$('.card.added').forEach(c => c.remove());
  const anchor = $('#leads')?.nextElementSibling; if (!anchor) return;
  state.added.slice().reverse().forEach(j => {
    const a = document.createElement('article'); a.className = 'card added';
    a.innerHTML = `<div class="card-head"><h3>${j.company}</h3><span class="pulse">Added by you · ${j.via}</span></div>
      <div class="job"><div class="job-title">${j.title} <span class="flag" style="background:#DCE8DE">Added by you</span></div><div class="meta">Added ${today}</div>
      <div class="actions"><button class="btn">Check fit</button><button class="btn quiet">Cover letter</button></div></div>
      <div class="card-foot"><button class="btn quiet">Exclude company</button><button class="btn">Reviewed</button></div>`;
    anchor.after(a);
  });
  updateLeadCount();
}

// ── Industry: section filters ──
function filterIndustry(label) {
  $$('.tabs a').forEach(a => a.setAttribute('aria-current', String(a.textContent === label)));
  $$('.news, .hero').forEach(n => { const src = $('.src', n).textContent; n.style.display = label === 'All' || src.includes(label) ? '' : 'none'; });
}

// ── Click handling (one listener, by button text) ──
document.addEventListener('click', e => {
  const el = e.target.closest('button, a'); if (!el || el.closest('dialog') || el.closest('.menu') || el.closest('.proto-note')) return;
  const text = el.textContent.trim(); const card = el.closest('.card'); const job = el.closest('.job'); const row = el.closest('.row, .list li');
  const hrefDummy = el.tagName === 'A' && el.getAttribute('href') === '#';
  if (text.startsWith('+ Add a job')) return openAddJob();
  if (page === 'today') {
    if (text === 'Reviewed') return hideCard(card, 'reviewed');
    if (text === 'Exclude company') return hideCard(card, 'excluded');
    if (text === 'Check fit') return showFit(job, true);
    if (text === 'Cover letter') return openCoverLetter(card, job);
  }
  if (page === 'industry' && el.closest('.tabs')) { e.preventDefault(); return filterIndustry(text); }
  if (page === 'watchlist') {
    const name = row && $('h3', row)?.textContent;
    if (text === 'Reviewed') { row.classList.add('leaving'); setTimeout(() => row.style.display = 'none', 250); state.watchHidden[name] = 1; save(); return toast(`${name} reviewed. It comes back with news, a change in who you know there, or in 30 days.`, () => { delete state.watchHidden[name]; save(); row.style.display = ''; row.classList.remove('leaving'); }); }
    if (text === 'Exclude') { row.classList.add('leaving'); setTimeout(() => row.style.display = 'none', 250); state.watchHidden[name] = 1; save(); return toast(`${name} excluded.`, () => { delete state.watchHidden[name]; save(); row.style.display = ''; row.classList.remove('leaving'); }); }
  }
  if (page === 'admin') {
    const key = row?.textContent.trim().slice(0, 40);
    const resolve = (html, msg) => { row.querySelector('.acts, button')?.closest('div.acts, button')?.replaceWith(Object.assign(document.createElement('span'), { className: 'pill ok', innerHTML: html })); state.admin[key] = html; save(); if (msg) toast(msg); };
    if (text === 'Confirm') return resolve('Locked', 'Board link confirmed and locked.');
    if (text === 'Wrong') return resolve('Set code by hand', 'Marked wrong. Set the code by hand, or mark it can\'t-check.');
    if (text === 'Re-probe') return resolve('Found brightline · pending', 'Re-probed: found a new Greenhouse code, waiting for your confirmation.');
    if (text === 'Dismiss') return resolve('Dismissed', 'Dismissed. Counting starts over.');
    if (text === 'Set code') return toast('In the real app: pick the provider and type the code. It stays locked.');
    if (text === 'Include again') { row.remove(); state.admin[key] = 'removed'; save(); return toast('Included again. It shows up on the next morning check.'); }
    if (text === 'Restore') { if (confirm('Restore this backup? Your current data is replaced, after saving a copy of it first.')) toast('Restored. A copy of the data before restoring was saved.'); return; }
    if (text === 'Import archive') { const f = Object.assign(document.createElement('input'), { type: 'file', accept: '.zip' }); f.onchange = () => toast(`Imported ${f.files[0]?.name || 'archive'}: 412 connections at 238 companies · 2 job changes.`); return f.click(); }
    if (text.startsWith('Request new export')) { e.preventDefault(); const s = el.closest('.panel').querySelectorAll('.sub')[1]; if (s) s.textContent = `Requested ${today}. Upload the ZIP when LinkedIn's email arrives.`; return toast('Opens LinkedIn\'s "Download your data" page. Click Request there.'); }
    if (text === 'Retry what failed') return toast('Retrying 2 boards… Brightline still failing, Atlas OK.');
    if (text === 'Add') {
      e.preventDefault(); const form = el.closest('form'); const input = $('input', form); const url = input.value.trim();
      if (!url) return toast('Paste a URL first.');
      if (/linkedin\.com/i.test(url)) return toast('LinkedIn URLs aren\'t allowed as sources.');
      $('.preview', form.parentElement)?.remove();
      const p = document.createElement('div'); p.className = 'preview';
      p.innerHTML = `RSS feed found · 20 items · robots.txt allows<label><input type="checkbox"> I've checked this site's terms allow automated reading</label><div class="foot" style="margin-top:.5rem;display:flex;gap:.5rem;justify-content:flex-end"><button class="btn solid" type="button" data-save>Save source</button></div>`;
      form.after(p);
      $('[data-save]', p).onclick = () => {
        const ok = $('input[type=checkbox]', p).checked; const host = url.replace(/^https?:\/\//, '').split('/')[0];
        const li = document.createElement('li'); li.innerHTML = `<div>${host}<span class="k">added ${today}</span></div><span class="pill ${ok ? 'ok' : ''}">${ok ? 'Fetched' : 'Link only'}</span>`;
        $('.list', form.parentElement).append(li); state.sources.push({ list: form.parentElement.querySelector('h2').textContent, host, ok }); save();
        p.remove(); input.value = ''; toast(ok ? `${host} will be read on the next morning check.` : `${host} saved as link only, since terms weren't confirmed.`);
      };
      return;
    }
  }
  if (hrefDummy) {
    e.preventDefault();
    if (text.startsWith('Apply')) { state.lastApply = Date.now(); save(); return toast('Opens the company\'s own posting in a new tab.'); }
    if (text.includes('careers page')) return toast(text.startsWith('Find') ? 'Opens a web search for this company\'s careers page.' : 'Opens the company\'s careers page in a new tab.');
    if (text.includes('↗')) return toast('Opens the source in a new tab.');
  }
});

// ── Restore saved state on load ──
if (page === 'today') {
  $$('.card').forEach(c => { if (state.hidden[$('h3', c).textContent]) c.style.display = 'none'; });
  $$('.job').forEach(j => { const t = $('.job-title', j)?.childNodes[0].textContent.trim(); if (state.fits[t]) showFit(j, false); });
  renderAdded();
}
if (page === 'watchlist') $$('.row').forEach(r => { if (state.watchHidden[$('h3', r).textContent]) r.style.display = 'none'; });

// ── Pipeline ──
const STAGES = ['Applied', 'Interviewing', 'Closed', 'Won'];
const daysAgo = n => new Date(Date.now() - n * 864e5).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
if (state.apps && state.apps.some(a => !a.stage)) delete state.apps; // earlier prototype shape
if (!state.apps) {
  state.apps = [
    { company: 'Lumen Health', title: 'Senior PM, Care Platform', stage: 'Interviewing', reachedInterview: true, applied: daysAgo(11), since: daysAgo(4), people: 'Priya Raman · Tier 1' },
    { company: 'Atlas Payments', title: 'Director of Product', stage: 'Applied', applied: daysAgo(6), since: daysAgo(6), people: 'Ken Mori · Tier 2' },
    { company: 'Harbor Labs', title: 'Group PM, Scheduling', stage: 'Closed', applied: daysAgo(27), since: daysAgo(9), people: '' },
    { company: 'Kestrel Health', title: 'VP Product', stage: 'Closed', applied: daysAgo(70), since: daysAgo(45), people: '' },
  ];
  save();
}
const sinceDays = a => Math.round((Date.now() - new Date(`${a.since} ${new Date().getFullYear()}`)) / 864e5);
function renderPipeline() {
  const board = $('#board'); if (!board) return;
  board.innerHTML = STAGES.map(st => {
    const all = state.apps.map((a, i) => ({ ...a, i })).filter(a => a.stage === st);
    const recent = st === 'Closed' ? all.filter(a => sinceDays(a) <= 30) : all;
    const older = st === 'Closed' ? all.filter(a => sinceDays(a) > 30) : [];
    const card = a => `<div class="app"><h3>${a.company}</h3><div class="role">${a.title}</div>
      <span class="k">Applied ${a.applied}${a.since !== a.applied ? ` · in this stage since ${a.since}` : ''}</span>${a.people ? `<span class="k">You know: ${a.people}</span>` : ''}
      <select aria-label="Move ${a.company} to" data-i="${a.i}"><option value="">Move to…</option>${STAGES.filter(x => x !== a.stage).map(x => `<option>${x}</option>`).join('')}</select></div>`;
    return `<section class="col ${st.toLowerCase()}"><h2>${st} <span>${all.length}</span></h2>${recent.map(card).join('')}
      ${older.length ? `<details class="older"><summary>${older.length} closed more than 30 days ago</summary>${older.map(card).join('')}</details>` : ''}</section>`;
  }).join('');
  $$('select', board).forEach(sel => sel.onchange = () => {
    if (!sel.value) return; const a = state.apps[sel.dataset.i]; if (sel.value === 'Interviewing' || sel.value === 'Won') a.reachedInterview = true; a.stage = sel.value; a.since = today; save(); renderPipeline(); toast(`${a.company} moved to ${a.stage}.`);
  });
}
function renderMetricsApps() {
  if (!$('#o-apps')) return;
  const n = st => state.apps.filter(a => a.stage === st).length;
  const total = state.apps.length, active = n('Applied') + n('Interviewing');
  const reached = state.apps.filter(a => a.reachedInterview || a.stage === 'Interviewing' || a.stage === 'Won').length;
  $('#o-apps').textContent = total;
  $('#o-apps-sub').textContent = `${active} active · open Pipeline →`;
  $('#o-rate').textContent = `${total ? Math.round(reached / total * 100) : 0}%`;
  $('#o-rate-sub').textContent = `${reached} of ${total} applications reached Interviewing`;
  $('#o-won').textContent = n('Won');
}
if (page === 'pipeline') renderPipeline();
if (page === 'metrics') renderMetricsApps();

// Today: Applied moves the job to Pipeline; the card leaves when nothing unapplied is left on it.
document.addEventListener('click', e => {
  const el = e.target.closest('button'); if (page !== 'today' || !el || el.textContent.trim() !== 'Applied') return;
  const card = el.closest('.card'), job = el.closest('.job');
  const company = $('h3', card).textContent, title = $('.job-title', job).childNodes[0].textContent.trim();
  const people = $$('.people li', card).slice(0, 1).map(li => `${$('.who', li).textContent} · ${$('.tier', li).textContent.split('·')[0].trim()}`).join('');
  state.apps.unshift({ company, title, stage: 'Applied', applied: today, since: today, people });
  state.appliedJobs = { ...(state.appliedJobs || {}), [title]: 1 }; save();
  job.remove();
  if (!$('.job', card)) { card.style.display = 'none'; updateLeadCount(); }
  toast(`${title} moved to Pipeline.`);
});
if (page === 'today') {
  $$('.job').forEach(j => { const t = $('.job-title', j)?.childNodes[0].textContent.trim(); if (state.appliedJobs?.[t]) j.remove(); });
  $$('.card').forEach(c => { if (!$('.job', c)) c.style.display = 'none'; });
  updateLeadCount();
}

// ── Metric tooltips (in the app these definitions live with the KPI config) ──
const TIPS = {
  'Applications': 'Jobs you marked Applied, all time. Active means still at Applied or Interviewing.',
  'Interview rate': 'Of all your applications, the share that reached Interviewing. It still counts if the application later closed or was won.',
  'Jobs won': 'Applications you moved to Won.',
  'Daily sweep time': 'How long your morning takes, from opening Today to reaching "All caught up." Averaged across the week.',
  'Posting to review': 'How long new jobs wait for you, from the day the app first saw the job to the day you reviewed its company or applied.',
  'Warm leads': 'Companies that showed up on Today this week with an open role and someone you know there.',
  'Outreach actions': 'Fit checks, cover letters, and jobs marked Applied this week.',
  'Morning check': 'How long the once-a-day job board check takes to finish.',
  'Board failures': 'The share of job board sites that failed during the morning check. Each failure is listed on Admin.',
  'AI spend': 'Estimated cost of fit checks and cover letters over the last 7 days. The app refuses AI calls that would go past $3.00.',
  'Accuracy': 'Two checks that should stay perfect: reviewed companies that came back without a truly new job (should be 0), and cover letters that stayed within your length caps.',
  'Readable boards': 'Companies whose job boards the app can read automatically. The rest are on your Watchlist.',
};
if (page === 'metrics') {
  $$('.kpi .name, .o-name').forEach((el, i) => {
    const def = TIPS[el.textContent.trim()]; if (!def) return;
    const tip = document.createElement('span'); tip.className = 'tip';
    tip.innerHTML = `<button type="button" aria-label="What is ${el.textContent.trim()}?" aria-describedby="tip-${i}">i</button><span role="tooltip" id="tip-${i}">${def}</span>`;
    tip.querySelector('button').addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); $$('.tip.open').forEach(t => t !== tip && t.classList.remove('open')); tip.classList.toggle('open'); });
    el.append(tip);
  });
  document.addEventListener('click', () => $$('.tip.open').forEach(t => t.classList.remove('open')));
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') $$('.tip.open').forEach(t => t.classList.remove('open')); });
}

// ── Admin panel tooltips ──
const ADMIN_TIPS = {
  'LinkedIn data': 'Your connections and profile come from LinkedIn\'s official data export. Request new export opens LinkedIn\'s download page, where you click Request. LinkedIn emails you a ZIP within 1 to 2 days, and Import archive uploads it. Re-import about monthly so job changes show up.',
  'Board links to confirm': 'The app guessed which job board each company uses. Confirm if the sample jobs look right, and the link stays locked. Wrong means it found a different company with the same name, so you set the code by hand.',
  'Stale board token?': 'This company\'s job board returned nothing for 3 days in a row, often because the company renamed its board. Re-probe looks for the new name. Set code lets you type it. Dismiss if the company simply has no openings.',
  'Lead gen sources': 'Job sites the app reads besides company boards. Add takes a site or feed URL, checks whether it can be read, and asks you to confirm the site\'s terms allow it. Fetched sources are read every morning. Link only sources stay as links you open yourself.',
  'Industry news sources': 'News sites for the Industry page. Add works the same as lead gen sources. Your call means the feed works but the site\'s terms couldn\'t be read, so you decide.',
  'Excluded companies': 'Companies you excluded never show up in leads and aren\'t checked. Include again brings a company back starting with the next morning check.',
  'Morning checks': 'The history of each day\'s job board check: how many boards, how long it took, and what failed. Retry what failed re-checks only the boards that failed.',
  'Backups': 'Copies of your data, saved before each morning check, import, and update. The last 14 are kept. Restore swaps in that copy after saving your current data first, so a restore can be undone.',
};
if (page === 'admin') {
  $$('.panel h2').forEach((el, i) => {
    const def = ADMIN_TIPS[el.textContent.trim()]; if (!def) return;
    const tip = document.createElement('span'); tip.className = 'tip';
    tip.innerHTML = `<button type="button" aria-label="What is ${el.textContent.trim()}?" aria-describedby="atip-${i}">i</button><span role="tooltip" id="atip-${i}">${def}</span>`;
    tip.querySelector('button').addEventListener('click', ev => { ev.stopPropagation(); $$('.tip.open').forEach(t => t !== tip && t.classList.remove('open')); tip.classList.toggle('open'); });
    el.append(tip);
  });
  document.addEventListener('click', () => $$('.tip.open').forEach(t => t.classList.remove('open')));
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') $$('.tip.open').forEach(t => t.classList.remove('open')); });
}
