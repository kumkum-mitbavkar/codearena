// Profile: solved by difficulty, streaks, a year-style heatmap and recent accepted solutions.
import { api, session } from '../api.js';
import { esc, initials, when, icons } from '../ui.js';
import { needsLogin } from './needs-login.js';

export async function render(app) {
  if (!session.user) return needsLogin(app, 'your profile');
  app.innerHTML = `<div class="page"><div class="empty">Loading…</div></div>`;
  const d = await api('profile');
  const circumference = 2 * Math.PI * 64;
  const weeks = matchMedia('(max-width: 720px)').matches ? 17 : 30;
  const pyShare = d.submissions ? Math.round((d.langs.python / d.submissions) * 100) : 0;

  app.innerHTML = `<div class="page">
    <div class="profile-grid">
      <aside class="card id-card">
        <div class="avatar">${esc(initials(d.user.name))}</div>
        <h2>${esc(d.user.name)}</h2>
        <div class="handle">@${esc(d.user.handle)}</div>
        <p class="muted" style="margin:8px 0 0;font-size:13px">${esc(d.user.college)}</p>
        <dl>
          <dt>Problems solved</dt><dd>${d.solved}</dd>
          <dt>Submissions</dt><dd>${d.submissions}</dd>
          <dt>Acceptance</dt><dd>${d.acceptance}%</dd>
          <dt>Current streak</dt><dd>${d.streak.current} ${d.streak.current === 1 ? 'day' : 'days'}</dd>
          <dt>Longest streak</dt><dd>${d.streak.longest} days</dd>
        </dl>
      </aside>
      <div>
        <section class="card solved-card" aria-label="Solved problems">
          <div class="ring">
            <svg viewBox="0 0 150 150"><circle class="track" cx="75" cy="75" r="64"/>
              <circle class="arc" id="ring-arc" cx="75" cy="75" r="64" stroke="var(--accent)" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"/></svg>
            <div class="label"><div><b class="num">${d.solved}</b><span>of ${d.totalProblems} solved</span></div></div>
          </div>
          <div class="dbar">${d.byDifficulty.map((x) => `<div><p><span class="diff diff-${x.difficulty}">${x.difficulty}</span><span class="num muted">${x.solved} / ${x.total}</span></p>
            <div class="track"><div class="fill" data-w="${x.total ? (x.solved / x.total) * 100 : 0}" style="width:0;background:var(--${x.difficulty.toLowerCase()})"></div></div></div>`).join('')}</div>
        </section>
        <section class="card heat-card" aria-label="Activity">
          <div class="row"><h3>${Object.values(d.heat).reduce((a, b) => a + b, 0)} submissions in the last ${weeks} weeks</h3>
            <div class="legend">Less ${[0, 1, 2, 3, 4].map((l) => `<i style="background:var(--heat-${l})"></i>`).join('')} More</div></div>
          ${heatmap(d.heat, d.today, weeks)}
          ${d.hasSample ? '<p class="muted" style="margin:10px 0 0;font-size:12px"><span class="sample">Sample</span> Activity before today is sample history for the demo account.</p>' : ''}
        </section>
        <section class="card badges-card" aria-label="Badges">
          <h3>Badges <span>${badges(d).filter((b) => b.earned).length} of ${badges(d).length} earned</span></h3>
          <div class="badges">${badges(d).map((b) => `<span class="badge ${b.earned ? '' : 'locked'}" title="${esc(b.how)}">${b.icon}${esc(b.label)}</span>`).join('')}</div>
        </section>
      </div>
    </div>
    <div class="two-col">
      <section class="card list-card"><h3>Recently solved</h3>
        ${d.recent.length ? d.recent.map((r) => `<a class="list-row" href="/problems/${r.problemId}" data-link><b>${esc(r.title)}</b><span class="muted">${r.sample ? '<span class="sample">Sample</span> ' : ''}${when(r.at)}</span></a>`).join('') : '<div class="empty">Solve a problem and it will show up here.</div>'}
      </section>
      <section class="card list-card"><h3>Languages</h3>
        <div class="lang-bar"><i style="width:${pyShare}%;background:var(--accent)"></i><i style="flex:1;background:var(--ink-2);opacity:.5"></i></div>
        <div class="lang-legend"><span><i style="background:var(--accent)"></i>Python ${d.langs.python}</span><span><i style="background:var(--ink-2);opacity:.5"></i>JavaScript ${d.langs.javascript}</span></div>
        <div class="list-row"><span class="muted">Accepted runs</span><b class="num">${Math.round((d.acceptance / 100) * d.submissions)}</b></div>
        <div class="list-row"><span class="muted">Problems left</span><b class="num">${d.totalProblems - d.solved}</b></div>
      </section>
    </div>
  </div>`;

  requestAnimationFrame(() => {
    document.getElementById('ring-arc').style.strokeDashoffset = circumference * (1 - d.solved / Math.max(1, d.totalProblems));
    document.querySelectorAll('.dbar .fill').forEach((f) => { f.style.width = f.dataset.w + '%'; });
  });
  return null;
}

function badges(d) {
  const hard = d.byDifficulty.find((x) => x.difficulty === 'Hard');
  return [
    { label: 'First Accepted', icon: icons.bolt, earned: d.solved >= 1, how: 'Get your first Accepted verdict' },
    { label: '7-day streak', icon: icons.flame, earned: d.streak.longest >= 7, how: 'Submit on seven days in a row' },
    { label: 'Polyglot', icon: icons.layers, earned: d.langs.python > 0 && d.langs.javascript > 0, how: 'Submit in both Python and JavaScript' },
    { label: 'Hard solver', icon: icons.medal, earned: Boolean(hard && hard.solved), how: 'Solve a Hard problem' },
    { label: 'Ten solved', icon: icons.circleCheck, earned: d.solved >= 10, how: 'Solve ten problems' },
  ];
}

function heatmap(heat, today, weeks) {
  const end = new Date(today + 'T00:00:00Z');
  const startOffset = (weeks - 1) * 7 + end.getUTCDay(); // start on a Sunday
  const cells = [];
  const months = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(end.getTime() - (startOffset - i) * 864e5);
    const key = day.toISOString().slice(0, 10);
    const n = heat[key] || 0;
    const level = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
    const future = day > end;
    if (i % 7 === 0) months.push(day.getUTCDate() <= 7 ? day.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) : '');
    cells.push(`<i data-l="${level}" class="${future ? 'future' : ''}" style="--c:${Math.floor(i / 7)}" title="${key}: ${n} submission${n === 1 ? '' : 's'}"></i>`);
  }
  return `<div class="heat-months" style="grid-template-columns:repeat(${weeks},1fr)">${months.map((m) => `<span>${m}</span>`).join('')}</div>
    <div class="heat" style="grid-template-columns:repeat(${weeks},1fr)">${cells.join('')}</div>`;
}
