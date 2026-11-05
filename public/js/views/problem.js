// The solving workspace: statement, editor, and the run/submit console.
// Desktop is a resizable split; phones get Problem / Code / Result tabs with a fixed action bar.
import { api, session } from '../api.js';
import { esc, icons, markdown, ms, hms, diffPill, verdictClass, when, toast, modal, $, $$ } from '../ui.js';
import { createEditor, codeViewer } from '../editor.js';
import { runnerFor, sameOutput } from '../runner.js';
import { navigate } from '../app.js';

const LANGS = { python: 'Python 3', javascript: 'JavaScript' };
const draftKey = (id, lang) => `ca-code:${id}:${lang}`;
const clip = (s, n = 600) => (s && s.length > n ? s.slice(0, n) + ' …' : s ?? '');
// results the worker produced, in order, up to the first test it never reached
const prefix = (list) => { const out = []; for (let i = 0; i < list.length && list[i]; i++) out.push({ output: list[i].output, error: list[i].error, ms: list[i].ms }); return out; };
/** Per-test runtime bars for an accepted submission: shows where the time actually went. */
function runtimeChart(rows) {
  const max = Math.max(...rows.map((r) => r.ms || 0), 0.001);
  return `<div class="rt-chart" aria-label="Runtime per hidden test">
    <div class="rt-head"><span>Runtime per hidden test</span><span class="num">slowest ${ms(max)}</span></div>
    <div class="rt-bars">${rows.map((r, i) => `<i style="--h:${Math.max(4, ((r.ms || 0) / max) * 100)}%;animation-delay:${i * 20}ms" title="Test ${i + 1}: ${ms(r.ms || 0)}"></i>`).join('')}</div>
  </div>`;
}

/** Highlight where your output and the expected output part ways (common prefix and suffix stay plain). */
function diffMark(mine, want) {
  const a = String(mine ?? ''), b = String(want ?? '');
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const wrap = (t) => {
    const mid = t.slice(p, t.length - s);
    return esc(t.slice(0, p)) + (mid ? `<mark>${esc(mid)}</mark>` : '') + esc(t.slice(t.length - s));
  };
  return [wrap(a), wrap(b)];
}
const AC_BADGE = `<span class="ac-burst" aria-hidden="true"><span class="ac-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg><i class="ray"></i><i class="ray"></i><i class="ray"></i><i class="ray"></i><i class="ray"></i><i class="ray"></i></span></span>`;
/** The clock that ran out: a dial that drains to zero, with the limit that was hit. */
const tleTimer = (limitMs) => `<div class="tle-timer"><svg class="dial" viewBox="0 0 44 44" aria-hidden="true"><circle class="track" cx="22" cy="22" r="18"/><circle class="arc" cx="22" cy="22" r="18"/></svg>
  <div><b>${(limitMs / 1000).toFixed(1)} s / ${(limitMs / 1000).toFixed(1)} s</b><span>Time ran out, so the run was stopped. Look for a loop that never ends, or an approach slower than needed.</span></div></div>`;
const pretty = (v) => JSON.stringify(v).replace(/,(?=\S)/g, ', ');

export async function render(app, [id], query) {
  app.innerHTML = `<div class="page" aria-busy="true"><span class="sr-only">Loading problem…</span><div class="skel" style="width:min(320px,70%);height:28px"></div><div class="skel" style="width:140px;height:14px;margin:16px 0 28px"></div>${'<div class="skel" style="height:12px;margin:0 0 12px"></div>'.repeat(5)}</div>`;
  let data;
  try { data = await api(`problem?id=${encodeURIComponent(id)}`); } catch (err) {
    app.innerHTML = `<div class="page"><div class="empty"><p>${esc(err.message)}</p><a class="btn" href="/problems" data-link>Back to problems</a></div></div>`;
    return null;
  }
  const { problem: p, limits } = data;
  let solved = data.solved;
  const contestMode = query.get('contest') === '1' && p.contest;
  let lang = localStorage.getItem('ca-lang') || 'python';
  if (!LANGS[lang]) lang = 'python';
  let view = 'problem';
  let caseIndex = 0;
  let lastRun = null;
  let busy = false;
  const timers = [];

  document.title = `${p.number}. ${p.title} · CodeArena`;
  app.innerHTML = `<div class="ws">
    <div class="ws-bar">
      <a class="btn btn-ghost btn-sm crumbs" href="${contestMode ? '/contest' : '/problems'}" data-link>${icons.back}<span class="back-label">${contestMode ? 'Sprint' : 'Problems'}</span></a>
      <div class="crumbs"><b>${p.number}. ${esc(p.title)}</b></div>
      <span class="spacer"></span>
      ${contestMode ? `<span class="contest-chip" title="Time left in the sprint"><span class="live-dot"></span><span id="ws-clock">--:--:--</span></span>` : ''}
    </div>
    <div class="ws-tabs" role="tablist" aria-label="Workspace">
      <button data-view="problem" class="on" role="tab">Problem</button>
      <button data-view="code" role="tab">Code</button>
      <button data-view="result" role="tab">Result <i id="result-dot"></i></button>
    </div>
    <div class="split" id="split" data-view="problem">
      <section class="pane pane-left" aria-label="Problem">
        <div class="pane-tabs"><button class="on" data-left="desc">Description</button><button data-left="subs">Submissions</button></div>
        <div class="pane-body" id="left-body"></div>
      </section>
      <div class="gutter" id="gutter" role="separator" aria-orientation="vertical" aria-label="Resize panels"></div>
      <section class="pane pane-right" aria-label="Code">
        <div class="pane-tabs editor-tools">
          <label class="sr-only" for="lang">Language</label>
          <select class="select lang-select" id="lang">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === lang ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <span class="py-status" id="py-status"></span>
          <div class="right">
            <button class="btn btn-ghost btn-sm" id="reset" title="Reset to the starter code">${icons.reset}<span>Reset</span></button>
          </div>
        </div>
        <div class="editor-wrap" id="editor"></div>
        <div class="console-resize" id="console-resize" role="separator" aria-label="Resize console"></div>
        <div class="console" id="console">
          <div class="pane-tabs">
            <button class="on" data-con="cases">Testcase</button><button data-con="result">Result</button>
            <div class="right actions">
              <span class="hint"><kbd>Ctrl</kbd> <kbd>↵</kbd></span>
              <button class="btn btn-sm" data-act="run">${icons.play}Run</button>
              <button class="btn btn-sm btn-submit" data-act="submit">${icons.upload}Submit</button>
            </div>
          </div>
          <div class="console-body" id="console-body"></div>
        </div>
      </section>
    </div>
    <div class="ws-actions">
      <button class="btn" data-act="run">${icons.play}Run</button>
      <button class="btn btn-submit" data-act="submit">${icons.upload}Submit</button>
    </div>
  </div>`;

  // ---------- statement ----------
  const leftBody = $('#left-body');
  const drawStatement = () => {
    leftBody.innerHTML = `<article class="statement">
      <h1>${p.number}. ${esc(p.title)}</h1>
      <div class="meta">${diffPill(p.difficulty)}${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
        ${solved ? `<span class="solved-badge">${icons.circleCheck}Solved</span>` : ''}
        ${contestMode ? `<span class="pill">Sprint problem</span>` : ''}</div>
      ${markdown(p.statement)}
      ${p.examples.map((ex, i) => `<h3>Example ${i + 1}</h3><div class="example">
        <div><b>Input:</b> ${esc(clip(ex.input, 400))}</div>
        <div><b>Output:</b> ${esc(clip(ex.output, 400))}</div>
        ${ex.explanation ? `<div class="why"><b>Why:</b> ${esc(ex.explanation)}</div>` : ''}</div>`).join('')}
      ${p.constraints.length ? `<h3>Constraints</h3><ul class="constraints">${p.constraints.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      <h3>How it's judged</h3>
      <p class="muted">Run checks the ${p.samples.length} sample cases above. Submit runs ${p.hiddenCount} hidden tests and the server decides the verdict. Time limit: ${limits.python / 1000} s for Python, ${limits.javascript / 1000} s for JavaScript, for the whole test set.</p>
    </article>`;
  };
  const drawMySubs = async () => {
    if (!session.user) {
      leftBody.innerHTML = `<div class="empty"><p>Sign in to see your submissions for this problem.</p><a class="btn btn-primary btn-sm" href="/login?next=${encodeURIComponent(location.pathname)}" data-link>Sign in</a></div>`;
      return;
    }
    leftBody.innerHTML = `<div class="empty">Loading…</div>`;
    const { submissions } = await api(`submissions?problem=${encodeURIComponent(p.id)}`);
    leftBody.innerHTML = submissions.length ? `<table class="subs-mini"><thead><tr><th>Verdict</th><th>Language</th><th>Runtime</th><th>When</th></tr></thead><tbody>
      ${submissions.map((s) => `<tr class="${s.hasCode ? 'click' : ''}" data-sub="${s.id}"><td class="${verdictClass(s.verdict)}" style="font-weight:600">${esc(s.verdict)}${s.sample ? ' <span class="sample">Sample</span>' : ''}</td><td>${LANGS[s.lang]}</td><td class="num">${s.runtimeMs == null ? '–' : s.runtimeMs + ' ms'}</td><td class="muted">${when(s.at)}</td></tr>`).join('')}
      </tbody></table>` : `<div class="empty">No submissions yet. Your attempts will show up here.</div>`;
    $$('tr[data-sub].click', leftBody).forEach((tr) => tr.addEventListener('click', () => openSubmission(tr.dataset.sub)));
  };
  $$('[data-left]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-left]').forEach((x) => x.classList.toggle('on', x === b));
    if (b.dataset.left === 'desc') drawStatement(); else drawMySubs();
  }));
  drawStatement();

  // ---------- editor ----------
  const starter = (l) => p.starter[l];
  const loadDraft = (l) => localStorage.getItem(draftKey(p.id, l)) ?? starter(l);
  const editor = createEditor($('#editor'), {
    doc: loadDraft(lang), lang,
    onChange: (code) => localStorage.setItem(draftKey(p.id, lang), code),
    onRun: () => run(), onSubmit: () => submit(),
  });

  const pyStatus = $('#py-status');
  const showRunnerState = (s) => {
    if (lang !== 'python') { pyStatus.innerHTML = '<span class="muted">Runs in a sandboxed worker</span>'; return; }
    pyStatus.innerHTML = s === 'loading' ? '<span class="spin"></span>Loading Python…'
      : s === 'ready' ? `<span style="color:var(--ok)">●</span> Python ready` : s === 'failed' ? '<span style="color:var(--bad)">Python failed to load</span>' : '';
  };
  const unsub = runnerFor('python').onStatus(showRunnerState);
  const warm = () => { if (lang === 'python') runnerFor('python').warm().catch(() => {}); showRunnerState(runnerFor(lang).state); };
  warm();

  $('#lang').addEventListener('change', (e) => {
    lang = e.target.value;
    localStorage.setItem('ca-lang', lang);
    editor.set(loadDraft(lang), lang);
    warm();
  });
  $('#reset').addEventListener('click', () => {
    if (editor.value !== starter(lang) && !confirm('Replace your code with the starter code?')) return;
    editor.set(starter(lang));
    localStorage.removeItem(draftKey(p.id, lang));
  });

  // ---------- console ----------
  const body = $('#console-body');
  const setConsoleTab = (tab) => $$('[data-con]').forEach((x) => x.classList.toggle('on', x.dataset.con === tab));
  const setView = (v) => {
    view = v;
    $('#split').dataset.view = v;
    $$('.ws-tabs [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  };
  $$('.ws-tabs [data-view]').forEach((b) => b.addEventListener('click', () => {
    setView(b.dataset.view);
    if (b.dataset.view === 'result' && !lastRun) drawCases();
    if (b.dataset.view === 'code') editor.view.requestMeasure();
  }));

  const argLines = (args) => p.params.map((name, i) => `${name} = ${clip(pretty(args[i]), 800)}`).join('\n');
  const drawCases = () => {
    setConsoleTab('cases');
    body.innerHTML = `<div class="cases">${p.samples.map((_, i) => `<button data-case="${i}" class="${i === caseIndex ? 'on' : ''}">Case ${i + 1}</button>`).join('')}</div>
      <div class="io"><div><label>Input</label><pre>${esc(argLines(p.samples[caseIndex].args))}</pre></div>
      <div><label>Expected output</label><pre>${esc(clip(pretty(p.samples[caseIndex].expected)))}</pre></div></div>`;
    $$('[data-case]', body).forEach((b) => b.addEventListener('click', () => { caseIndex = +b.dataset.case; drawCases(); }));
  };
  $$('[data-con]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.con === 'cases') drawCases(); else if (lastRun) lastRun.draw(); else { setConsoleTab('result'); body.innerHTML = '<div class="empty">Run or submit your code to see results here.</div>'; }
  }));
  drawCases();

  const setResultDot = (verdict) => {
    const dot = $('#result-dot');
    dot.style.background = verdict === 'Accepted' ? 'var(--ok)' : verdict === 'Time Limit Exceeded' ? 'var(--warn)' : verdict ? 'var(--bad)' : 'transparent';
  };
  const setBusy = (on, label) => {
    busy = on;
    $$('[data-act]').forEach((b) => { b.disabled = on; });
    if (on) {
      setConsoleTab('result');
      setView(matchMedia('(max-width: 720px)').matches ? 'result' : view);
      body.innerHTML = `<div class="running"><span class="spin" style="width:14px;height:14px;border:2px solid var(--line-strong);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite;display:inline-block"></span>${esc(label)}</div><div class="tests-grid" id="live-grid"></div>`;
    }
  };
  const runningLabel = (what) => (lang === 'python' && runnerFor('python').state !== 'ready' ? 'Starting Python in your browser (first run only)…' : what);

  async function run() {
    if (busy) return;
    setBusy(true, runningLabel('Running sample cases…'));
    try {
      const r = await runnerFor(lang).run({ code: editor.value, fnName: p.fn[lang], inputs: p.samples.map((t) => t.args), limitMs: limits[lang] });
      const cases = p.samples.map((t, i) => {
        const res = r.results[i];
        if (!res) return { status: r.stop === 'tle' && i === r.results.filter(Boolean).length ? 'timeout' : 'skipped' };
        if (res.error) return { status: 'error', ...res };
        return { status: sameOutput(res.output, t.expected) ? 'passed' : 'failed', ...res };
      });
      const compileError = r.results[0]?.compile ? r.results[0].error : null;
      const verdict = r.stop === 'tle' ? 'Time Limit Exceeded' : cases.some((c) => c.status === 'error') || compileError ? 'Runtime Error' : cases.every((c) => c.status === 'passed') ? 'Accepted' : 'Wrong Answer';
      caseIndex = Math.max(0, cases.findIndex((c) => c.status !== 'passed'));
      lastRun = { draw: () => drawRun(verdict, cases, compileError) };
      setResultDot(verdict);
      lastRun.draw();
    } catch (err) {
      body.innerHTML = `<div class="err">${esc(err.message)}</div>`;
    } finally { setBusy(false); }
  }

  function drawRun(verdict, cases, compileError) {
    setConsoleTab('result');
    const total = cases.reduce((t, c) => t + (c.ms || 0), 0);
    const c = cases[caseIndex];
    body.innerHTML = `<div class="verdict">${verdict === 'Accepted' ? AC_BADGE : ''}<h2 class="${verdictClass(verdict)}">${verdict === 'Accepted' ? 'Sample cases passed' : esc(verdict)}</h2>
        <span class="num">Runtime ${ms(total)} · ${cases.filter((x) => x.status === 'passed').length}/${cases.length} cases</span></div>
      ${verdict === 'Time Limit Exceeded' ? tleTimer(limits[lang]) : ''}
      ${compileError ? `<div class="err">${esc(compileError)}</div>` : ''}
      <div class="cases">${cases.map((x, i) => `<button data-case="${i}" class="${i === caseIndex ? 'on' : ''}"><i class="${x.status === 'passed' ? 'pass' : x.status === 'skipped' ? '' : 'fail'}"></i>Case ${i + 1}</button>`).join('')}</div>
      <div class="io">
        <div><label>Input</label><pre>${esc(argLines(p.samples[caseIndex].args))}</pre></div>
        ${c.error && !c.compile ? `<div><label>Error</label><div class="err" style="margin:0">${esc(c.error)}</div></div>` : ''}
        ${c.status === 'passed' ? `<div><label>Your output</label><pre>${esc(clip(c.output))}</pre></div>` : ''}
        ${c.status === 'failed' ? `<div><label>Your output</label><pre class="diff-bad">${diffMark(clip(c.output), clip(pretty(p.samples[caseIndex].expected)))[0]}</pre></div>` : ''}
        ${c.status === 'timeout' ? `<div><label>Your output</label><pre>Did not finish in time</pre></div>` : ''}
        <div><label>Expected output</label><pre class="${c.status === 'failed' ? 'diff-good' : ''}">${c.status === 'failed' ? diffMark(clip(c.output), clip(pretty(p.samples[caseIndex].expected)))[1] : esc(clip(pretty(p.samples[caseIndex].expected)))}</pre></div>
        ${c.stdout ? `<div><label>Printed (stdout)</label><pre>${esc(clip(c.stdout, 2000))}</pre></div>` : ''}
      </div>`;
    $$('[data-case]', body).forEach((b) => b.addEventListener('click', () => { caseIndex = +b.dataset.case; drawRun(verdict, cases, compileError); }));
  }

  async function submit() {
    if (busy) return;
    if (!session.user) {
      toast('Sign in to submit. Demo: student@codearena.in');
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setBusy(true, runningLabel(`Running ${p.hiddenCount} hidden tests…`));
    const grid = () => $('#live-grid');
    if (grid()) grid().innerHTML = p.hiddenInputs.map(() => '<i></i>').join('');
    try {
      const local = await runnerFor(lang).run({
        code: editor.value, fnName: p.fn[lang], inputs: p.hiddenInputs, limitMs: limits[lang],
        onResult: (i) => { const cell = grid()?.children[i]; if (cell) cell.className = 'ran'; },
      });
      $('.running', body)?.replaceChildren(document.createTextNode('Checking with the server…'));
      const res = await api('submit', {
        method: 'POST',
        body: {
          problemId: p.id, lang, code: editor.value, contest: contestMode,
          stop: local.stop,
          results: prefix(local.results),
        },
      });
      if (res.verdict === 'Accepted' && !solved) { solved = true; if ($('[data-left="desc"]').classList.contains('on')) drawStatement(); }
      lastRun = { draw: () => drawSubmit(res) };
      setResultDot(res.verdict);
      lastRun.draw();
    } catch (err) {
      body.innerHTML = `<div class="err">${esc(err.message)}</div>`;
    } finally { setBusy(false); }
  }

  function drawSubmit(res) {
    setConsoleTab('result');
    const ok = res.verdict === 'Accepted';
    const f = res.firstFail;
    body.innerHTML = `<div class="verdict">
        ${ok ? AC_BADGE : ''}<h2 class="${verdictClass(res.verdict)}">${esc(res.verdict)}</h2>
        <span class="num">${res.passed}/${res.total} hidden tests passed</span>
      </div>
      ${res.verdict === 'Time Limit Exceeded' ? tleTimer(limits[res.submission.lang] || limits[lang]) : ''}
      <div class="tests-grid" aria-label="Hidden tests">${res.rows.map((r, i) => `<i class="${r.status}" style="animation-delay:${i * 12}ms" title="Test ${i + 1}: ${r.status}"></i>`).join('')}</div>
      <div class="stat-row">
        <div class="stat-box"><span>Runtime</span><b>${ok ? ms(res.runtimeMs) : '–'}</b></div>
        <div class="stat-box"><span>Language</span><b>${LANGS[res.submission.lang]}</b></div>
        ${contestMode ? `<div class="stat-box"><span>Sprint</span><b>${ok ? 'Points added' : '+10 min penalty'}</b></div>` : ''}
      </div>
      ${ok ? runtimeChart(res.rows) : ''}
      <p class="server-note">${icons.shield}${res.checkedOnServer ? 'Re-run on the server in a sandbox; that run decided the verdict.' : 'Your outputs were checked on the server against answers that never reach the browser.'}</p>
      ${f ? `<div class="io" style="margin-top:12px">
        <div><label>Failed on hidden test ${f.index + 1}</label><pre>${esc(f.input)}</pre></div>
        ${f.error ? `<div><label>Error</label><div class="err" style="margin:0">${esc(f.error)}</div></div>` : ''}
        ${f.output !== undefined && !f.error ? `<div><label>Your output</label><pre class="diff-bad">${f.expected !== undefined ? diffMark(f.output, f.expected)[0] : esc(f.output)}</pre></div>` : ''}
        ${f.expected !== undefined ? `<div><label>Expected output</label><pre class="${f.output !== undefined && !f.error ? 'diff-good' : ''}">${f.output !== undefined && !f.error ? diffMark(f.output, f.expected)[1] : esc(f.expected)}</pre></div>` : ''}
      </div>` : ''}
      ${ok && contestMode ? `<p style="margin-top:14px"><a class="btn btn-accent btn-sm" href="/contest" data-link>See the leaderboard ${icons.arrow}</a></p>` : ''}`;
  }

  async function openSubmission(subId) {
    const { submission: s } = await api(`submissions?id=${encodeURIComponent(subId)}`);
    const holder = document.createElement('div');
    const m = modal({ title: `${s.verdict} · ${LANGS[s.lang]} · ${when(s.at)}`, body: holder });
    codeViewer(holder, s.code || '', s.lang);
    return m;
  }

  $$('[data-act="run"]').forEach((b) => b.addEventListener('click', run));
  $$('[data-act="submit"]').forEach((b) => b.addEventListener('click', submit));

  // ---------- desktop resizing ----------
  const split = $('#split');
  const savedLeft = localStorage.getItem('ca-left');
  if (savedLeft) split.style.setProperty('--left', savedLeft);
  const gutter = $('#gutter');
  gutter.addEventListener('pointerdown', (e) => {
    gutter.setPointerCapture(e.pointerId);
    gutter.classList.add('drag');
    const rect = split.getBoundingClientRect();
    const move = (ev) => {
      const pct = Math.min(65, Math.max(28, ((ev.clientX - rect.left) / rect.width) * 100));
      split.style.setProperty('--left', pct + '%');
    };
    const up = () => { gutter.classList.remove('drag'); gutter.removeEventListener('pointermove', move); localStorage.setItem('ca-left', split.style.getPropertyValue('--left')); };
    gutter.addEventListener('pointermove', move);
    gutter.addEventListener('pointerup', up, { once: true });
  });
  const handle = $('#console-resize');
  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    const pane = handle.parentElement.getBoundingClientRect();
    const move = (ev) => { const h = Math.min(pane.height - 140, Math.max(120, pane.bottom - ev.clientY)); $('#console').style.setProperty('--console-h', h + 'px'); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', move), { once: true });
  });

  // ---------- sprint clock ----------
  if (contestMode) {
    const { contest } = await api('contest');
    const offset = contest.now - Date.now();
    const tick = () => { const el = $('#ws-clock'); if (el) el.textContent = hms(contest.end - (Date.now() + offset)); };
    tick();
    timers.push(setInterval(tick, 1000));
  }

  return () => { timers.forEach(clearInterval); unsub(); editor.destroy(); document.title = 'CodeArena · Coding practice and contests'; };
}
