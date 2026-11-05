// The live sprint: clock, the three problems, and a leaderboard that refreshes every few seconds.
import { api, session } from '../api.js';
import { esc, icons, hms, clockTime, diffPill, flip, $ } from '../ui.js';

export async function render(app) {
  app.innerHTML = `<div class="page" aria-busy="true"><span class="sr-only">Loading the sprint…</span><div class="skel" style="width:90px;height:20px"></div><div class="skel" style="width:min(360px,80%);height:34px;margin:14px 0 30px"></div><div class="card plist">${'<div class="prow skel-row"><span class="skel" style="width:22px;height:14px"></span><span class="skel" style="height:14px;width:55%"></span></div>'.repeat(6)}</div></div>`;
  let data = await api('contest');
  let offset = data.contest.now - Date.now();
  let previousRanks = {};

  const draw = () => {
    const { contest, problems, me, leaderboard } = data;
    app.innerHTML = `<div class="page">
      <div class="contest-top">
        <div>
          <span class="pill"><span class="live-dot"></span>LIVE NOW</span>
          <h1>${esc(contest.title)}</h1>
          <p class="muted" style="margin:0">${clockTime(contest.start)} – ${clockTime(contest.end)} IST · a new sprint starts every two hours</p>
        </div>
        <div><div class="clock-label">Ends in</div><div class="clock num" id="contest-clock">${hms(contest.end - (Date.now() + offset))}</div></div>
      </div>
      <div class="contest-grid">
        <div style="display:grid;gap:18px;grid-template-columns:minmax(0,1fr)">
          <div class="card">
            ${problems.map((p) => `<div class="cprob ${p.solved ? 'done' : ''}">
              <div class="pts">${p.solved ? icons.check.replace('<svg', '<svg width="18" height="18"') : p.points}</div>
              <div class="t"><b>${esc(p.title)}</b><span>${diffPill(p.difficulty)} <span class="muted">${p.points} pts${p.wrong ? ` · ${p.wrong} wrong ${p.wrong === 1 ? 'try' : 'tries'}` : ''}</span></span></div>
               <a class="btn btn-sm ${p.solved ? '' : 'btn-accent'}" href="/problems/${p.id}?contest=1" data-link>${p.solved ? 'View' : 'Solve'}</a>
            </div>`).join('')}
          </div>
          <div class="card rules">
            ${me ? `<p style="margin:0 0 8px;color:var(--ink)"><b>You: rank ${me.rank}</b> · ${me.points} points · ${me.penalty} penalty min</p>` : ''}
            ${session.user ? '' : `<p style="margin:0 0 10px"><a class="btn btn-accent btn-sm" href="/login?next=/contest" data-link>Sign in to compete</a></p>`}
            Points: 100 / 200 / 300. Ties are broken by penalty: the minute of each accepted solve, plus ${contest.penaltyMinutes} minutes for every wrong try before it. Hidden tests decide every verdict.
          </div>
        </div>
        <div class="card">
          <div class="board-head"><h2>Leaderboard</h2><span class="muted" style="font-size:12.5px">Updates live · players marked Sample are demo players</span></div>
          <div class="board-scroll"><table class="board">
            <thead><tr><th>#</th><th>Player</th><th>Score</th><th class="hide-sm">Penalty</th>${problems.map((p, i) => `<th class="cell hide-sm" title="${esc(p.title)}">${'ABC'[i]}</th>`).join('')}</tr></thead>
            <tbody>${leaderboard.map((r) => `<tr data-name="${esc(r.name)}" class="${r.you ? 'you' : ''}">
              <td class="rank">${r.rank}</td>
              <td><div class="name">${esc(r.name)}${r.you ? ' <span class="pill" style="height:18px">You</span>' : ''}${r.sample ? ' <span class="sample">Sample</span>' : ''}</div></td>
              <td class="score">${r.points}</td>
              <td class="num muted hide-sm">${r.points ? r.penalty : '–'}</td>
              ${r.solved.map((s) => `<td class="cell hide-sm ${s.solved ? 'ok' : s.wrong ? 'no' : ''}">${s.solved ? `${s.minute}′${s.wrong ? `<sup>+${s.wrong}</sup>` : ''}` : s.wrong ? `−${s.wrong}` : '·'}</td>`).join('')}
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>
    </div>`;
    previousRanks = Object.fromEntries(leaderboard.map((r) => [r.name, r.rank]));
  };
  draw();

  const tick = setInterval(() => {
    const el = $('#contest-clock');
    if (!el) return;
    const left = data.contest.end - (Date.now() + offset);
    el.textContent = hms(left);
    if (left <= 0) refresh(); // the next sprint has started
  }, 1000);
  const refresh = async () => {
    try {
      data = await api('contest');
      offset = data.contest.now - Date.now();
      flip(app, draw, '.board tbody tr[data-name]');
    } catch { /* keep showing the last board */ }
  };
  const poll = setInterval(refresh, 5000);
  return () => { clearInterval(tick); clearInterval(poll); };
}
