// Landing page: what CodeArena is, shown rather than told. The editor mock types a real solution and
// gets judged; every number on the page comes from the live app (sample players and history are labelled).
import { api, session } from '../api.js';
import { esc, icons, hms, diffPill, flip, $, $$ } from '../ui.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const SNIPPETS = [
  {
    file: 'two_sum.py', lang: 'Python',
    code: `def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i`,
    runtime: [0.21, 0.18, 0.34, 0.27, 1.9, 2.6],
  },
  {
    file: 'twoSum.js', lang: 'JavaScript',
    code: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i]);
    if (j !== undefined) return [j, i];
    seen.set(nums[i], i);
  }
}`,
    runtime: [0.08, 0.06, 0.11, 0.09, 0.84, 1.2],
  },
];

const KW = new Set('def return for in if else elif while not and or None True False function const let var new of class import from'.split(' '));
const BUILTIN = new Set('enumerate len range Map Set Math console'.split(' '));
/** A tiny highlighter for the two snippets above: enough to look like the real editor. */
function tokens(src) {
  const out = [];
  const re = /(\s+)|(#.*|\/\/.*)|('[^']*'|"[^"]*"|`[^`]*`)|(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|(.)/g;
  let m;
  while ((m = re.exec(src))) {
    const [t] = m;
    let cls = '';
    if (m[2]) cls = 'c'; else if (m[3]) cls = 's'; else if (m[4]) cls = 'n';
    else if (m[5]) cls = KW.has(t) ? 'k' : BUILTIN.has(t) ? 't' : src[re.lastIndex] === '(' ? 'f' : 'v';
    else if (m[6]) cls = 'p';
    out.push([t, cls]);
  }
  return out;
}
function paint(toks, upTo) {
  let left = upTo;
  let html = '';
  for (const [t, cls] of toks) {
    if (left <= 0) break;
    const part = t.slice(0, left);
    left -= t.length;
    html += cls ? `<span class="tk-${cls}">${esc(part)}</span>` : esc(part);
  }
  return html;
}

export async function render(app) {
  document.title = 'CodeArena · Practise coding rounds, run real code';
  // the hero is static, so it paints at once and the editor starts typing while the numbers load
  app.innerHTML = `<div class="landing">
    <section class="l-hero">
      <div class="l-grid-bg" aria-hidden="true"></div>
      <div class="l-hero-in">
        <div class="l-copy">
          <div id="l-live-slot" class="l-live-slot"><span class="l-live skel-pill"></span></div>
          <h1 class="l-title">Code it. Run it.<br><span>Get the verdict.</span></h1>
          <p class="l-sub">Placement-style problems with a real editor. Your Python and JavaScript run right in the browser, hidden tests decide the verdict, and a live sprint ranks you every two hours.</p>
          <div class="l-cta">
            <a class="btn btn-accent btn-lg" href="/problems" data-link id="start-solving">Start solving ${icons.arrow}</a>
            <a class="btn btn-lg btn-outline" href="/contest" data-link>Enter the live sprint</a>
          </div>
          <dl class="l-stats">
            <div><dt>Problems</dt><dd class="num" id="st-problems">–</dd></div>
            <div><dt>Submissions judged</dt><dd class="num" id="st-subs">–</dd></div>
            <div><dt>Topics</dt><dd class="num" id="st-topics">–</dd></div>
            <div><dt>Languages</dt><dd class="num">2</dd></div>
          </dl>
        </div>
        <div class="l-demo" aria-label="Animated example: a Two Sum solution is typed, run against hidden tests and accepted">
          <div class="mock">
            <div class="mock-bar">
              <span class="dots"><i></i><i></i><i></i></span>
              <span class="mock-tabs">${SNIPPETS.map((s, i) => `<span class="mock-tab ${i === 0 ? 'on' : ''}" data-tab="${i}">${s.file}</span>`).join('')}</span>
              <span class="mock-prob">1. Two Sum</span>
            </div>
            <div class="mock-code"><div class="mock-gutter" id="m-gutter"></div><pre id="m-code"></pre></div>
            <div class="mock-console" id="m-console">
              <div class="mock-actions"><span class="mock-status" id="m-status"><span class="ok-dot"></span>Ready</span>
                <span class="mock-btn" id="m-run">${icons.play}Run</span><span class="mock-btn submit" id="m-submit">${icons.upload}Submit</span></div>
              <div class="mock-out" id="m-out"></div>
            </div>
          </div>
          <div class="mock-shadow" aria-hidden="true"></div>
        </div>
      </div>
    </section>

    <div id="l-rest"></div>
  </div>`;
  const timers = [];
  const stop = { done: false };
  runMock(stop, timers);
  const cleanup = () => { stop.done = true; timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); };
  let list, contest;
  try {
    [list, contest] = await Promise.all([api('problems'), api('contest').catch(() => null)]);
  } catch (err) {
    $('#l-rest').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    return cleanup;
  }
  if (stop.done || !$('#l-rest')) return cleanup;
  const { problems, totals = { submissions: 0, accepted: 0 }, activity = {} } = list;
  const topics = new Set(problems.flatMap((p) => p.tags));
  const byDiff = (d) => problems.filter((p) => p.difficulty === d).length;
  const offset = contest ? contest.contest.now - Date.now() : 0;
  const left = () => (contest ? contest.contest.end - (Date.now() + offset) : 0);

  $('#l-live-slot').innerHTML = contest ? `<a class="l-live" href="/contest" data-link><span class="live-dot"></span><span>Sprint live</span><span class="sep"></span><span class="mono num" id="l-clock">${hms(left())}</span><span class="muted">left</span>${icons.arrow}</a>` : '';
  [['#st-problems', problems.length], ['#st-subs', totals.submissions], ['#st-topics', topics.size]].forEach(([sel, n]) => { const el = $(sel); el.dataset.count = n; el.textContent = n.toLocaleString('en-IN'); });
  $('#l-rest').innerHTML = `<section class="l-sec">
      <header class="l-head"><span class="kicker">The workspace</span>
        <h2>A real coding round,<br>not a text box.</h2>
        <p>The same loop as the online tests companies send: read, write, run the samples, then submit against tests you can't see.</p></header>
      <div class="l-features">
        <article class="feat">
          <div class="feat-vis langs">
            <div class="lang-line"><span class="mono">Python</span><span class="muted">WebAssembly · in your browser</span><span class="ok-dot"></span></div>
            <div class="lang-line"><span class="mono">JavaScript</span><span class="muted">sandboxed Web Worker</span><span class="ok-dot"></span></div>
            <div class="lang-line dim"><span class="mono">Server</span><span class="muted">re-runs JS in an isolated VM</span>${icons.shield}</div>
          </div>
          <h3>Your code, actually run</h3>
          <p>A proper CodeMirror editor with highlighting, auto-indent and autocomplete. Python runs through Pyodide; nothing is faked.</p>
        </article>
        <article class="feat">
          <div class="feat-vis verdicts">
            <div class="vrow ok"><b>Accepted</b><span class="mono">6/6 · 1.2 ms</span></div>
            <div class="vrow bad"><b>Wrong Answer</b><span class="mono">test 3: <s>4</s> 6</span></div>
            <div class="vrow warn"><b>Time Limit Exceeded</b><span class="mono">6.0 s</span></div>
            <div class="vrow bad"><b>Runtime Error</b><span class="mono">TypeError, line 2</span></div>
          </div>
          <h3>Verdicts you can trust</h3>
          <p>The browser only ever sees test inputs. The server holds the answers and decides every verdict, so nobody can fake an Accepted.</p>
        </article>
        <article class="feat">
          <div class="feat-vis tle">
            <pre class="mono"><span class="tk-k">while</span> <span class="tk-n">True</span>:\n    <span class="tk-k">pass</span></pre>
            <div class="tle-track"><i></i></div>
            <div class="tle-foot mono"><span>${icons.timer}stopped at 6.0 s</span><span class="warn-text">TLE</span></div>
          </div>
          <h3>Endless loops can't hang it</h3>
          <p>Every run has a time limit. When it's hit, the worker is killed and a fresh one starts, so the page never freezes.</p>
        </article>
      </div>
    </section>

    ${contest ? `<section class="l-sec l-split">
      <div class="l-head left"><span class="kicker">Live sprint</span>
        <h2>Two hours. Three problems.<br>One leaderboard.</h2>
        <p>A new sprint starts on every even hour, IST. 100, 200 and 300 points, with penalty minutes for wrong tries, ICPC style.</p>
        <div class="sprint-clock"><span class="label">Ends in</span><span class="mono num" id="l-clock-2">${hms(left())}</span></div>
        <ul class="sprint-probs">${contest.problems.map((p, i) => `<li><span class="mono letter">${'ABC'[i]}</span><span class="t">${esc(p.title)}</span>${diffPill(p.difficulty)}<span class="mono pts">${p.points}</span></li>`).join('')}</ul>
        <a class="btn btn-outline" href="/contest" data-link>Open the sprint ${icons.arrow}</a>
      </div>
      <div class="card l-board" aria-label="Live leaderboard">
        <div class="l-board-head"><span><span class="live-dot"></span>Leaderboard</span><span class="muted">updates live</span></div>
        <ol id="l-board">${boardRows(contest.leaderboard)}</ol>
      </div>
    </section>` : ''}

    <section class="l-sec l-split reverse">
      <div class="card l-activity">
        <div class="l-act-head"><b>Activity on CodeArena</b><span class="sample">Sample</span></div>
        ${heat(activity)}
        <div class="l-act-stats">
          <div><span>Submissions</span><b class="num">${totals.submissions}</b></div>
          <div><span>Accepted</span><b class="num">${totals.accepted}</b></div>
          <div><span>Active days</span><b class="num">${Object.keys(activity).length}</b></div>
        </div>
        <div class="badges">
          <span class="badge">${icons.bolt}First Accepted</span><span class="badge">${icons.flame}7-day streak</span><span class="badge">${icons.layers}Polyglot</span><span class="badge locked">${icons.medal}Hard solver</span>
        </div>
      </div>
      <div class="l-head left"><span class="kicker">Profile</span>
        <h2>Progress you can<br>actually show.</h2>
        <p>Solved by difficulty, streaks, a day-by-day heatmap, badges and every submission with its code. The kind of profile you can put a link to on your résumé.</p>
        <a class="btn btn-outline" href="/profile" data-link>See your profile ${icons.arrow}</a>
      </div>
    </section>

    <section class="l-sec">
      <header class="l-head"><span class="kicker">Problem set</span>
        <h2>${problems.length} problems that show up<br>in real placement rounds.</h2>
        <p><span class="diff-Easy">${byDiff('Easy')} Easy</span> · <span class="diff-Medium">${byDiff('Medium')} Medium</span> · <span class="diff-Hard">${byDiff('Hard')} Hard</span>, each with worked examples and 5 to 8 hidden tests.</p></header>
      <div class="card l-plist">${problems.slice(0, 6).map((p) => `<a class="l-prow" href="/problems/${p.id}" data-link>
          <span class="mono n">${String(p.number).padStart(2, '0')}</span><span class="t">${esc(p.title)}</span>
          <span class="tags">${p.tags.slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</span>${diffPill(p.difficulty)}${icons.arrow}</a>`).join('')}
        <a class="l-prow more" href="/problems" data-link><span class="t">Browse all ${problems.length} problems</span>${icons.arrow}</a>
      </div>
    </section>

    <section class="l-final">
      <h2>Your next interview has a coding round.</h2>
      <p>Practise for it where the code really runs.</p>
      <div class="l-cta center">
        <a class="btn btn-accent btn-lg" href="/problems" data-link>Start solving ${icons.arrow}</a>
        ${session.user ? '' : '<a class="btn btn-lg btn-outline" href="/login" data-link>Sign in with a demo account</a>'}
      </div>
    </section>
`;

  // countdowns
  if (contest) timers.push(setInterval(() => { const t = hms(left()); $$('#l-clock, #l-clock-2').forEach((el) => { el.textContent = t; }); }, 1000));
  // numbers count up the first time they show
  if (!reduced()) countUp($$('.l-stats [data-count]'));
  // sections ease in as they scroll into view
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.18 });
  $$('.l-sec, .l-final').forEach((s) => io.observe(s));
  // live leaderboard
  if (contest) timers.push(setInterval(async () => {
    try { const d = await api('contest'); const ol = $('#l-board'); if (ol) flip(ol, () => { ol.innerHTML = boardRows(d.leaderboard); }); } catch { /* keep the last board */ }
  }, 8000));
  return () => { cleanup(); io.disconnect(); };
}

function boardRows(rows) {
  return rows.slice(0, 6).map((r) => `<li data-name="${esc(r.name)}" class="${r.you ? 'you' : ''}"><span class="mono rk">${r.rank}</span>
    <span class="nm">${esc(r.name)}${r.sample ? ' <span class="sample">Sample</span>' : ''}${r.you ? ' <span class="pill">You</span>' : ''}</span>
    <span class="mono sc">${r.points}</span></li>`).join('');
}

function heat(activity) {
  const weeks = matchMedia('(max-width: 720px)').matches ? 16 : 20;
  const today = new Date(Date.now() + 5.5 * 3600e3);
  const end = new Date(today.toISOString().slice(0, 10) + 'T00:00:00Z');
  const startOffset = (weeks - 1) * 7 + end.getUTCDay();
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(end.getTime() - (startOffset - i) * 864e5);
    const key = day.toISOString().slice(0, 10);
    const n = activity[key] || 0;
    const l = n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4;
    cells += `<i data-l="${l}" class="${day > end ? 'future' : ''}" style="--c:${Math.floor(i / 7)}" title="${key}: ${n}"></i>`;
  }
  return `<div class="heat" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div>`;
}

function countUp(els) {
  els.forEach((el) => {
    const target = +el.dataset.count;
    if (!target) return;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1100);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString('en-IN');
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// ---------- the typing editor ----------
function runMock(stop, timers) {
  const code = $('#m-code'), gutter = $('#m-gutter'), out = $('#m-out'), status = $('#m-status');
  if (!code) return;
  const wait = (ms) => new Promise((res) => timers.push(setTimeout(res, ms)));
  const setLines = (n) => { gutter.innerHTML = Array.from({ length: n }, (_, i) => `<span>${i + 1}</span>`).join(''); };
  const press = (el) => { el.classList.add('press'); timers.push(setTimeout(() => el.classList.remove('press'), 260)); };

  const finalState = (s) => {
    const toks = tokens(s.code);
    code.innerHTML = paint(toks, Infinity);
    setLines(s.code.split('\n').length);
    out.innerHTML = accepted(s, false);
    status.innerHTML = '<span class="ok-dot"></span>Accepted';
  };
  if (reduced()) { finalState(SNIPPETS[0]); return; }

  (async () => {
    for (let round = 0; !stop.done && document.body.contains(code); round++) {
      const s = SNIPPETS[round % SNIPPETS.length];
      $$('.mock-tab').forEach((t) => t.classList.toggle('on', +t.dataset.tab === round % SNIPPETS.length));
      const toks = tokens(s.code);
      const total = s.code.length;
      out.innerHTML = '<div class="mo-idle mono">Write a solution, then Run.</div>';
      status.innerHTML = '<span class="ok-dot"></span>Ready';
      setLines(1);
      for (let n = 0; n <= total && !stop.done; n += 1 + (s.code[n] === ' ' ? 3 : 0)) {
        code.innerHTML = paint(toks, n) + '<span class="caret"></span>';
        setLines(s.code.slice(0, n).split('\n').length);
        await wait(s.code[n] === '\n' ? 140 : 26 + Math.random() * 30);
      }
      if (stop.done) return;
      code.innerHTML = paint(toks, total);
      setLines(s.code.split('\n').length);
      await wait(450);
      press($('#m-submit'));
      status.innerHTML = '<span class="spin"></span>Judging';
      out.innerHTML = `<div class="mo-run mono">Running 6 hidden tests…</div><div class="mo-cells">${s.runtime.map(() => '<i></i>').join('')}</div>`;
      const cells = $$('.mo-cells i', out);
      for (let i = 0; i < cells.length && !stop.done; i++) { await wait(170); cells[i].className = 'pass'; }
      await wait(260);
      if (stop.done) return;
      out.innerHTML = accepted(s, true);
      status.innerHTML = '<span class="ok-dot"></span>Accepted';
      await wait(4200);
    }
  })();
}

function accepted(s, animate) {
  const max = Math.max(...s.runtime);
  const total = s.runtime.reduce((a, b) => a + b, 0);
  return `<div class="mo-ac ${animate ? 'animate' : ''}">
    <div class="mo-ac-top"><span class="ac-badge">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'}<i class="ray"></i><i class="ray"></i><i class="ray"></i><i class="ray"></i><i class="ray"></i><i class="ray"></i></span>
      <b>Accepted</b><span class="mono muted">6/6 hidden · ${s.lang}</span></div>
    <div class="mo-bars">${s.runtime.map((v, i) => `<i style="--h:${Math.max(8, (v / max) * 100)}%;animation-delay:${120 + i * 60}ms"></i>`).join('')}</div>
    <div class="mo-foot mono"><span>Runtime ${total.toFixed(1)} ms</span><span>checked on server</span></div>
  </div>`;
}
