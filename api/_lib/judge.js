// Verdicts. Hidden expected outputs never leave the server: the browser runs the code on the
// hidden inputs and sends back what it produced, and the verdict is decided here.
// JavaScript is also re-run here in a separate V8 context with a time limit, and that run wins.
import vm from 'node:vm';

export const LIMITS = { javascript: 3000, python: 6000 }; // ms for a whole test set
const SERVER_JS_LIMIT = 2500;

/** Canonical form so 1 and 1.0, or different spacing, compare equal. */
export function canonical(value) {
  return JSON.stringify(value);
}

export function sameOutput(produced, expected) {
  let parsed;
  try { parsed = typeof produced === 'string' ? JSON.parse(produced) : produced; } catch { return false; }
  return canonical(parsed) === canonical(expected);
}

const clip = (v, n = 160) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + '…' : s; };

/**
 * results: what the browser reported per hidden test, in order: { output, error, ms }.
 * stop: 'tle' when the browser killed the run on the time limit, 'error' on an exception.
 */
export function verdictFromOutputs(problem, results, stop) {
  const tests = problem.hidden;
  const rows = [];
  let verdict = 'Accepted';
  let firstFail = null;
  for (let i = 0; i < tests.length; i++) {
    const r = results[i];
    if (!r) {
      if (verdict === 'Accepted') verdict = stop === 'tle' ? 'Time Limit Exceeded' : 'Runtime Error';
      rows.push({ index: i, status: stop === 'tle' && i === results.length ? 'timeout' : 'skipped' });
      continue;
    }
    if (r.error) {
      verdict = 'Runtime Error';
      rows.push({ index: i, status: 'error', ms: r.ms, error: clip(r.error, 400) });
      firstFail = firstFail || { index: i, input: clip(tests[i].args), error: clip(r.error, 400) };
      continue;
    }
    const ok = sameOutput(r.output, tests[i].expected);
    rows.push({ index: i, status: ok ? 'passed' : 'failed', ms: r.ms });
    if (!ok) {
      if (verdict === 'Accepted') verdict = 'Wrong Answer';
      firstFail = firstFail || { index: i, input: clip(tests[i].args), expected: clip(tests[i].expected), output: clip(r.output) };
    }
  }
  const passed = rows.filter((x) => x.status === 'passed').length;
  const runtimeMs = rows.reduce((t, x) => t + (x.ms || 0), 0);
  return { verdict, passed, total: tests.length, rows, firstFail, runtimeMs: Math.round(runtimeMs) };
}

/**
 * Runs JavaScript source against a list of argument lists in a fresh V8 context.
 * Only strings cross into the context (no host objects), and the whole run has a deadline,
 * so an endless loop ends as a timeout instead of hanging the function.
 */
export function runJavaScript(code, fnName, inputs, limitMs = SERVER_JS_LIMIT) {
  const source = `
var console = { log() {}, info() {}, warn() {}, error() {}, table() {} };
var __inputs = JSON.parse(${JSON.stringify(JSON.stringify(inputs))});
${code}
;(function () {
  var fn = typeof ${fnName} === 'function' ? ${fnName} : undefined;
  if (!fn) return JSON.stringify({ missing: true });
  var out = [];
  for (var i = 0; i < __inputs.length; i++) {
    var t0 = Date.now();
    try {
      var r = fn.apply(null, __inputs[i]);
      out.push({ output: JSON.stringify(r === undefined ? null : r), ms: Date.now() - t0 });
    } catch (e) {
      out.push({ error: String(e && e.message ? (e.name || 'Error') + ': ' + e.message : e), ms: Date.now() - t0 });
      break;
    }
  }
  return JSON.stringify(out);
})()`;
  const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false }, microtaskMode: 'afterEvaluate' });
  try {
    const raw = new vm.Script(source, { filename: 'solution.js' }).runInContext(context, { timeout: limitMs });
    const parsed = JSON.parse(String(raw));
    if (parsed.missing) return { stop: 'error', results: [{ error: `ReferenceError: ${fnName} is not defined. Keep the function name from the starter code.` }] };
    const last = parsed[parsed.length - 1];
    return { stop: last && last.error ? 'error' : null, results: parsed };
  } catch (err) {
    if (err && err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return { stop: 'tle', results: [] };
    return { stop: 'error', results: [{ error: `${err && err.name ? err.name : 'Error'}: ${err && err.message ? err.message : err}` }] };
  }
}

/** The full judgement for one submission. */
export function judge(problem, { lang, code, results, stop }) {
  if (lang === 'javascript') {
    const server = runJavaScript(code, problem.fn.javascript, problem.hidden.map((t) => t.args));
    const outcome = verdictFromOutputs(problem, server.results, server.stop);
    // runtimes measured in the browser are finer-grained than Date.now() here; keep them when they line up
    if (Array.isArray(results)) outcome.rows.forEach((row, i) => { if (results[i] && typeof results[i].ms === 'number') row.ms = results[i].ms; });
    outcome.runtimeMs = Math.round(outcome.rows.reduce((t, x) => t + (x.ms || 0), 0));
    return { ...outcome, checkedOnServer: true };
  }
  const safe = Array.isArray(results) ? results.slice(0, problem.hidden.length).map((r) => ({
    output: typeof r?.output === 'string' ? r.output.slice(0, 2e6) : undefined,
    error: r?.error ? String(r.error).slice(0, 2000) : undefined,
    ms: Number.isFinite(r?.ms) ? Math.max(0, r.ms) : 0,
  })) : [];
  return { ...verdictFromOutputs(problem, safe, stop === 'tle' ? 'tle' : stop === 'error' ? 'error' : null), checkedOnServer: false };
}
