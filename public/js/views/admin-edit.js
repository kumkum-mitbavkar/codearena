// Create or edit a problem: statement, function signature, sample and hidden tests.
// A reference solution can fill in expected outputs by running it in the browser.
import { api, session } from '../api.js';
import { esc, icons, toast, $, $$ } from '../ui.js';
import { needsLogin } from './needs-login.js';
import { runnerFor } from '../runner.js';
import { navigate } from '../app.js';

const blank = { title: '', difficulty: 'Easy', tags: '', statement: '', constraints: '', params: '', fnPython: '', fnJavascript: '', samples: [{ args: '', expected: '' }], hidden: [{ args: '', expected: '' }] };
const show = (v) => JSON.stringify(v);
const ident = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The same rules the server applies, checked first so mistakes are caught without a round trip. */
function check(p) {
  if (p.title.trim().length < 3) return 'Give the problem a title (at least 3 characters).';
  if (p.statement.trim().length < 20) return 'The statement is too short to solve from.';
  const params = p.params.split(',').map((s) => s.trim()).filter(Boolean);
  if (!params.length || !params.every((x) => ident.test(x))) return 'Parameters must be names like nums, target.';
  if (!ident.test(p.fnPython.trim()) || !ident.test(p.fnJavascript.trim())) return 'Function names may use letters, digits and _ only.';
  for (const [kind, label] of [['samples', 'Sample'], ['hidden', 'Hidden']]) {
    for (const [i, t] of p[kind].entries()) {
      let args;
      try { args = JSON.parse(t.args); } catch { return `${label} test ${i + 1}: the input is not valid JSON.`; }
      if (!Array.isArray(args) || args.length !== params.length) return `${label} test ${i + 1}: give one value per parameter, as a JSON list like [[2,7,11], 9].`;
      try { JSON.parse(t.expected); } catch { return `${label} test ${i + 1}: the expected output is not valid JSON (use the reference solution to fill it).`; }
    }
  }
  return '';
}

export async function render(app, [id]) {
  if (!session.user) return needsLogin(app, 'the admin panel');
  if (session.user.role !== 'admin') { app.innerHTML = `<div class="page"><div class="card empty">Only the admin account can edit problems.</div></div>`; return null; }
  const isNew = id === 'new';
  let form = { ...blank };
  if (!isNew) {
    const { problem: p } = await api(`admin?id=${encodeURIComponent(id)}`);
    form = {
      id: p.id, title: p.title, difficulty: p.difficulty, tags: p.tags.join(', '), statement: p.statement, constraints: p.constraints.join('\n'),
      params: p.params.join(', '), fnPython: p.fn.python, fnJavascript: p.fn.javascript,
      samples: p.samples.map((t) => ({ args: show(t.args), expected: show(t.expected) })),
      hidden: p.hidden.map((t) => ({ args: show(t.args), expected: show(t.expected) })),
    };
  }

  app.innerHTML = `<div class="page" style="max-width:920px">
    <div class="page-head"><div><a class="muted" href="/admin" data-link>← Admin</a><h1 style="margin-top:6px">${isNew ? 'New problem' : `Edit: ${esc(form.title)}`}</h1></div></div>
    <form class="card form" id="pform" novalidate>
      <div class="form-row">
        <label class="field"><span>Title</span><input class="input" name="title" required value="${esc(form.title)}" placeholder="e.g. Sum of Digits"></label>
        <div class="form-row" style="gap:10px">
          <label class="field"><span>Difficulty</span><select class="select" name="difficulty">${['Easy', 'Medium', 'Hard'].map((d) => `<option ${form.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
          <label class="field"><span>Topics</span><input class="input" name="tags" value="${esc(form.tags)}" placeholder="Math, Loops"></label>
        </div>
      </div>
      <label class="field"><span>Statement</span><textarea class="textarea" name="statement" rows="6" placeholder="Describe the task. Use \`backticks\` for code and a line starting with - for a list.">${esc(form.statement)}</textarea><small>Blank line = new paragraph · \`code\` · lines starting with "- " become a list</small></label>
      <label class="field"><span>Constraints</span><textarea class="textarea" name="constraints" rows="3" placeholder="One per line">${esc(form.constraints)}</textarea></label>
      <div class="form-row three">
        <label class="field"><span>Parameters</span><input class="input mono" name="params" value="${esc(form.params)}" placeholder="nums, target"></label>
        <label class="field"><span>Python function</span><input class="input mono" name="fnPython" value="${esc(form.fnPython)}" placeholder="digit_sum"></label>
        <label class="field"><span>JavaScript function</span><input class="input mono" name="fnJavascript" value="${esc(form.fnJavascript)}" placeholder="digitSum"></label>
      </div>
      ${['samples', 'hidden'].map((kind) => `<div>
        <div class="section-title"><h3>${kind === 'samples' ? 'Sample tests' : 'Hidden tests'} <span class="muted" style="font-weight:450">· input as a JSON list with one value per parameter</span></h3>
          <button type="button" class="btn btn-sm" data-add="${kind}">${icons.plus}Add test</button></div>
        <div class="tests-edit" id="tests-${kind}"></div>
      </div>`).join('')}
      <div class="ref-box">
        <div class="section-title"><h3>Fill expected outputs from a reference solution</h3><button type="button" class="btn btn-sm" id="fill">Run reference</button></div>
        <textarea class="textarea" id="ref-code" placeholder="function digitSum(n) {&#10;  return String(n).split('').reduce((a, d) => a + +d, 0);&#10;}"></textarea>
        <small class="muted">Paste a correct JavaScript solution. It runs in your browser on every test input and writes the expected outputs for you.</small>
      </div>
      <div class="form-error" id="perr" hidden></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <a class="btn" href="/admin" data-link>Cancel</a>
        <button class="btn btn-primary" type="submit">${isNew ? 'Create problem' : 'Save changes'}</button>
      </div>
    </form>
  </div>`;

  const el = $('#pform');
  const drawTests = (kind) => {
    $(`#tests-${kind}`).innerHTML = form[kind].map((t, i) => `<div class="test-line">
      <span class="n">${i + 1}</span>
      <input class="input" data-k="${kind}" data-i="${i}" data-f="args" value="${esc(t.args)}" placeholder="input, e.g. [[2,7,11,15], 9]" aria-label="${kind} test ${i + 1} input">
      <input class="input" data-k="${kind}" data-i="${i}" data-f="expected" value="${esc(t.expected)}" placeholder="expected, e.g. [0,1]" aria-label="${kind} test ${i + 1} expected output">
      <button type="button" class="icon-btn" data-del="${kind}:${i}" aria-label="Remove test ${i + 1}">${icons.trash}</button>
    </div>`).join('');
  };
  const drawAll = () => { drawTests('samples'); drawTests('hidden'); };
  drawAll();

  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) form[t.dataset.k][+t.dataset.i][t.dataset.f] = t.value;
  });
  el.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { form[add.dataset.add].push({ args: '', expected: '' }); drawTests(add.dataset.add); $(`#tests-${add.dataset.add} .test-line:last-child input`).focus(); }
    const del = e.target.closest('[data-del]');
    if (del) {
      const [kind, i] = del.dataset.del.split(':');
      if (form[kind].length === 1) { toast('Keep at least one test here'); return; }
      form[kind].splice(+i, 1); drawTests(kind);
    }
  });

  $('#fill').addEventListener('click', async () => {
    const code = $('#ref-code').value.trim();
    const fn = el.fnJavascript.value.trim();
    if (!code || !fn) { toast('Add the JavaScript function name and a reference solution first'); return; }
    const all = [...form.samples, ...form.hidden];
    let inputs;
    try { inputs = all.map((t) => JSON.parse(t.args)); } catch { toast('Every test needs a valid JSON input first'); return; }
    const r = await runnerFor('javascript').run({ code, fnName: fn, inputs, limitMs: 4000 });
    if (r.stop) { toast(r.stop === 'tle' ? 'The reference solution ran out of time' : `Reference failed: ${r.results.find((x) => x?.error)?.error}`); return; }
    all.forEach((t, i) => { t.expected = r.results[i].output; });
    drawAll();
    toast(`Filled ${all.length} expected outputs`);
  });

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(el);
    const problem = { ...form, ...Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('t-'))) };
    const errBox = $('#perr');
    errBox.hidden = true;
    const problemWith = check(problem);
    if (problemWith) {
      errBox.textContent = problemWith;
      errBox.hidden = false;
      errBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    try {
      const { problem: saved } = await api('admin', { method: 'POST', body: { problem } });
      toast(isNew ? 'Problem created' : 'Changes saved');
      navigate(`/problems/${saved.id}`);
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
      errBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
  return null;
}
