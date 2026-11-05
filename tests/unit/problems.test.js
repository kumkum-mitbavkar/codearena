import test from 'node:test';
import assert from 'node:assert/strict';
import { allProblems, cleanProblem, forSolver } from '../../api/_lib/problems.js';

const empty = () => ({ problems: {}, submissions: [] });
const draft = {
  title: 'Sum of Digits', difficulty: 'Easy', tags: 'Math, Loops', statement: 'Return the sum of the digits of a non-negative integer n.',
  params: 'n', fnPython: 'digit_sum', fnJavascript: 'digitSum', constraints: '0 ≤ n ≤ 10⁹',
  samples: [{ args: '[123]', expected: '6' }], hidden: [{ args: '[0]', expected: '0' }, { args: '[9999]', expected: '36' }],
};

test('the solver view keeps hidden answers on the server', () => {
  const p = forSolver(allProblems(empty())[0]);
  assert.equal(p.hidden, undefined);
  assert.ok(p.hiddenInputs.length > 0);
  assert.ok(!JSON.stringify(p).includes('"expected":' + JSON.stringify(allProblems(empty())[0].hidden[0].expected) + '}]}'));
});

test('admin can add a problem; it gets the next number and generated starters', () => {
  const data = empty();
  const p = cleanProblem(draft, data);
  assert.equal(p.id, 'sum-of-digits');
  assert.equal(p.number, 16);
  assert.match(p.starter.python, /def digit_sum\(n\):/);
  assert.deepEqual(p.hidden[1], { args: [9999], expected: 36 });
  data.problems[p.id] = p;
  assert.equal(allProblems(data).length, 16);
  assert.throws(() => cleanProblem(draft, data), /already exists/);
});

test('editing keeps the id and number', () => {
  const data = empty();
  const p = cleanProblem({ ...draft, id: 'two-sum', title: 'Two Sum (edited)', params: 'nums, target', samples: [{ args: '[[1,2],3]', expected: '[0,1]' }], hidden: [{ args: '[[1,3],4]', expected: '[0,1]' }] }, data);
  assert.equal(p.id, 'two-sum');
  assert.equal(p.number, 1);
});

test('bad admin input gets a plain message', () => {
  assert.throws(() => cleanProblem({ ...draft, difficulty: 'Tough' }, empty()), /Pick a difficulty/);
  assert.throws(() => cleanProblem({ ...draft, samples: [{ args: '[1, 2]', expected: '3' }] }, empty()), /one value per parameter/);
  assert.throws(() => cleanProblem({ ...draft, hidden: [{ args: '[1', expected: '3' }] }, empty()), /not valid JSON/);
  assert.throws(() => cleanProblem({ ...draft, fnPython: 'digit sum' }, empty()), /Function names/);
});
