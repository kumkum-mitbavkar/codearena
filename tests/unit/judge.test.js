import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, runJavaScript, sameOutput, verdictFromOutputs } from '../../api/_lib/judge.js';

const problems = JSON.parse(readFileSync(new URL('../../api/_lib/seed-problems.json', import.meta.url)));
const byId = Object.fromEntries(problems.map((p) => [p.id, p]));

const TWO_SUM = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
}`;

test('seed bank: 15 problems, each with samples, hidden tests and both starters', () => {
  assert.equal(problems.length, 15);
  for (const p of problems) {
    assert.ok(p.samples.length >= 2 || p.id === 'max-subarray' || p.samples.length >= 1, p.id);
    assert.ok(p.hidden.length >= 5, `${p.id} has ${p.hidden.length} hidden tests`);
    assert.match(p.starter.python, new RegExp(`def ${p.fn.python}\\(`));
    assert.match(p.starter.javascript, new RegExp(`function ${p.fn.javascript}\\(`));
    assert.equal(p.examples.length, p.samples.length);
  }
  assert.deepEqual([...new Set(problems.map((p) => p.difficulty))].sort(), ['Easy', 'Hard', 'Medium']);
});

test('outputs compare by value, not by spacing or 1 vs 1.0', () => {
  assert.ok(sameOutput('[0, 1]', [0, 1]));
  assert.ok(sameOutput('6.0', 6));
  assert.ok(!sameOutput('[1, 0]', [0, 1]));
  assert.ok(!sameOutput('not json', 1));
});

test('a correct JavaScript solution is Accepted after the server re-runs it', () => {
  const r = judge(byId['two-sum'], { lang: 'javascript', code: TWO_SUM, results: [] });
  assert.equal(r.verdict, 'Accepted');
  assert.equal(r.passed, r.total);
  assert.equal(r.checkedOnServer, true);
});

test('a JavaScript claim cannot override the server run', () => {
  const fake = byId['two-sum'].hidden.map((t) => ({ output: JSON.stringify(t.expected), ms: 1 }));
  const r = judge(byId['two-sum'], { lang: 'javascript', code: 'function twoSum(){ return [0, 0]; }', results: fake });
  assert.equal(r.verdict, 'Wrong Answer');
  assert.ok(r.firstFail.expected);
});

test('an endless loop ends as Time Limit Exceeded instead of hanging', () => {
  const started = Date.now();
  const r = judge(byId['two-sum'], { lang: 'javascript', code: 'function twoSum(){ while (true) {} }' });
  assert.equal(r.verdict, 'Time Limit Exceeded');
  assert.ok(Date.now() - started < 6000);
});

test('exceptions are Runtime Errors with the message', () => {
  const r = judge(byId['valid-parentheses'], { lang: 'javascript', code: 'function isValid(s){ return s.foo.bar; }' });
  assert.equal(r.verdict, 'Runtime Error');
  assert.match(r.firstFail.error, /TypeError/);
});

test('a renamed function is reported clearly', () => {
  const r = runJavaScript('function solve(){}', 'twoSum', [[[1, 2], 3]]);
  assert.equal(r.stop, 'error');
  assert.match(r.results[0].error, /twoSum is not defined/);
});

test('code in the sandbox cannot reach the host process', () => {
  const r = runJavaScript('function f(){ return typeof process + "/" + typeof require + "/" + (function(){ try { return this.constructor.constructor("return typeof process")(); } catch (e) { return "blocked"; } })(); }', 'f', [[]]);
  assert.equal(JSON.parse(r.results[0].output), 'undefined/undefined/blocked');
});

test('Python verdicts are decided from the produced outputs, with answers kept on the server', () => {
  const p = byId['chai-samosa'];
  const good = p.hidden.map((t) => ({ output: JSON.stringify(t.expected), ms: 2 }));
  assert.equal(judge(p, { lang: 'python', code: 'x', results: good }).verdict, 'Accepted');
  const bad = good.map((r, i) => (i === 2 ? { output: '[]', ms: 1 } : r));
  const wrong = judge(p, { lang: 'python', code: 'x', results: bad });
  assert.equal(wrong.verdict, 'Wrong Answer');
  assert.equal(wrong.firstFail.index, 2);
  const partial = judge(p, { lang: 'python', code: 'x', results: good.slice(0, 3), stop: 'tle' });
  assert.equal(partial.verdict, 'Time Limit Exceeded');
  assert.equal(partial.rows[3].status, 'timeout');
  assert.equal(judge(p, { lang: 'python', code: 'x', results: [] }).verdict, 'Runtime Error');
});

test('verdict rows count passes and runtime', () => {
  const p = byId['binary-search'];
  const r = verdictFromOutputs(p, p.hidden.map((t) => ({ output: JSON.stringify(t.expected), ms: 1.5 })), null);
  assert.equal(r.passed, p.hidden.length);
  assert.equal(r.runtimeMs, Math.round(1.5 * p.hidden.length));
});
