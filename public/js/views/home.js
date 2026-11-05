// Problem list: search, difficulty, status and topic filters, plus the live sprint.
import { api, session } from '../api.js';
import { esc, icons, hms, diffPill, $, $$ } from '../ui.js';

const state = { q: '', diff: 'All', status: 'all', topic: null };

export async function render(app) {
  app.innerHTML = `<div class="page" aria-busy="true"><span class="sr-only">Loading problems…</span>
    <div class="skel" style="width:120px;height:12px"></div><div class="skel" style="width:min(420px,80%);height:34px;margin:14px 0 26px"></div>
    <div class="card plist">${'<div class="prow skel-row"><span class="skel" style="width:18px;height:18px;border-radius:50%"></span><span class="skel" style="height:14px;width:60%"></span></div>'.repeat(8)}</div></div>`;
  const [{ problems }, contestData] = await Promise.all([api('problems'), api('contest').catch(() => null)]);
  const user = session.user;
  const solved = problems.filter((p) => p.status === 'solved');
  const topics = {};
  problems.forEach((p) => p.tags.forEach((t) => { topics[t] = (topics[t] || 0) + 1; }));
  const counts = (d) => problems.filter((p) => p.difficulty === d);

  app.innerHTML = `<div class="page">
    <section class="hero">
      <div>
        <div class="eyebrow">Problem set</div>
        <h1>Pick a problem.<br><span class="muted">Ship an Accepted.</span></h1>
        <p>Write Python or JavaScript, run the sample cases, then submit against hidden tests the server checks.</p>
        <div class="hero-stats">
          <div><b class="num">${problems.length}</b><span>problems</span></div>
          <div><b class="num">${Object.keys(topics).length}</b><span>topics</span></div>
          <div><b>2</b><span>languages</span></div>
          ${user ? `<div><b class="num">${solved.length}</b><span>solved by you</span></div>` : ''}
        </div>
      </div>
      ${contestData ? contestCard(contestData) : ''}
    </section>

    ${user ? `<div class="card progress-strip" aria-label="Your progress">
      <b class="num">${solved.length}/${problems.length} solved</b>
      <div class="bar">${['Easy', 'Medium', 'Hard'].map((d) => `<i style="width:${(solved.filter((p) => p.difficulty === d).length / problems.length) * 100}%;background:var(--${d.toLowerCase()})"></i>`).join('')}</div>
      ${['Easy', 'Medium', 'Hard'].map((d) => `<span class="diff diff-${d} num">${d} ${solved.filter((p) => p.difficulty === d).length}/${counts(d).length}</span>`).join('')}
    </div>` : ''}

    <div class="filters">
      <label class="search"><span class="sr-only">Search problems</span>${icons.search}<input class="input" id="q" type="search" placeholder="Search by title or topic" value="${esc(state.q)}" autocomplete="off"></label>
      <div class="seg" role="group" aria-label="Difficulty">${['All', 'Easy', 'Medium', 'Hard'].map((d) => `<button data-diff="${d}" class="${state.diff === d ? 'on' : ''}">${d}</button>`).join('')}</div>
      ${user ? `<select class="select" id="status" aria-label="Status">
        <option value="all">All statuses</option><option value="solved">Solved</option><option value="attempted">Attempted</option><option value="todo">Not started</option>
      </select>` : ''}
    </div>
    <div class="topics" role="group" aria-label="Topics">${Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<button data-topic="${esc(t)}" class="${state.topic === t ? 'on' : ''}">${esc(t)}<span>${n}</span></button>`).join('')}</div>
    <div class="card plist">
      <div class="plist-head"><span></span><span>Title</span><span>Topics</span><span>Acceptance</span><span>Difficulty</span></div>
      <div id="rows"></div>
    </div>
  </div>`;

  const status = $('#status');
  if (status) status.value = state.status;
  const draw = () => {
    const q = state.q.trim().toLowerCase();
    const rows = problems.filter((p) =>
      (state.diff === 'All' || p.difficulty === state.diff) &&
      (!state.topic || p.tags.includes(state.topic)) &&
      (state.status === 'all' || (state.status === 'todo' ? !p.status : p.status === state.status)) &&
      (!q || p.title.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q)) || String(p.number) === q));
    $('#rows').innerHTML = rows.length ? rows.map(row).join('') : `<div class="empty">No problems match these filters. <button class="btn btn-sm" id="clear">Clear filters</button></div>`;
    $('#clear')?.addEventListener('click', () => { Object.assign(state, { q: '', diff: 'All', status: 'all', topic: null }); render(app); });
  };
  draw();

  $('#q').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
  status?.addEventListener('change', (e) => { state.status = e.target.value; draw(); });
  $$('[data-diff]').forEach((b) => b.addEventListener('click', () => {
    state.diff = b.dataset.diff;
    $$('[data-diff]').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  $$('[data-topic]').forEach((b) => b.addEventListener('click', () => {
    state.topic = state.topic === b.dataset.topic ? null : b.dataset.topic;
    $$('[data-topic]').forEach((x) => x.classList.toggle('on', x.dataset.topic === state.topic));
    draw();
  }));

  // live countdown on the sprint card
  if (!contestData) return null;
  const offset = contestData.contest.now - Date.now();
  const tick = () => { const el = $('#home-clock'); if (el) el.firstChild.textContent = hms(contestData.contest.end - (Date.now() + offset)); };
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

function row(p) {
  const icon = p.status === 'solved' ? `<span class="status-icon solved" title="Solved">${icons.circleCheck}</span>`
    : p.status === 'attempted' ? `<span class="status-icon attempted" title="Attempted">${icons.circleDot}</span>` : '<span></span>';
  return `<a class="prow" href="/problems/${p.id}" data-link>
    ${icon}
    <span class="title-wrap"><span class="title" style="display:block"><em>${p.number}.</em>${esc(p.title)}</span>
      <span class="meta-phone"><span>${esc(p.tags.slice(0, 2).join(' · '))}</span>${p.acceptance == null ? '' : `<span>· ${p.acceptance}% acc.</span>`}</span></span>
    <span class="tags">${p.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${p.contest ? '<span class="tag">Sprint</span>' : ''}</span>
    <span class="acc num muted"><span class="acc-bar ${p.acceptance == null ? 'none' : ''}"><i style="width:${p.acceptance ?? 0}%"></i></span>${p.acceptance == null ? '–' : p.acceptance + '%'}</span>
    ${diffPill(p.difficulty)}
  </a>`;
}

function contestCard({ contest, leaderboard }) {
  const top = leaderboard.slice(0, 3);
  return `<a class="card contest-card" href="/contest" data-link aria-label="Open the live sprint">
    <div class="row"><h3>${esc(contest.title)}</h3><span class="pill"><span class="live-dot"></span>LIVE</span></div>
    <div class="clock num" id="home-clock">${hms(contest.end - contest.now)}<small>left</small></div>
    <div class="mini-board">${top.map((r) => `<div><span>${r.rank}. ${esc(r.name)} ${r.sample ? '<span class="sample">Sample</span>' : ''}</span><span class="num">${r.points}</span></div>`).join('')}</div>
    <span class="btn btn-accent btn-sm" style="align-self:flex-start">Enter the sprint ${icons.arrow}</span>
  </a>`;
}
