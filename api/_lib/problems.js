// The problem bank: the seed problems shipped with the code, with any admin edits and new
// problems from the data store laid over them.
import { readFileSync } from 'node:fs';
import { HttpError } from './http.js';

const SEED = JSON.parse(readFileSync(new URL('./seed-problems.json', import.meta.url), 'utf8'));
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export function allProblems(data) {
  const merged = SEED.map((p) => data.problems[p.id] || p);
  const extra = Object.values(data.problems).filter((p) => !SEED.some((s) => s.id === p.id));
  return [...merged, ...extra.sort((a, b) => a.number - b.number)];
}

export function findProblem(data, id) {
  const p = allProblems(data).find((x) => x.id === id);
  if (!p) throw new HttpError(404, 'That problem does not exist.');
  return p;
}

/** What a solver sees: samples with answers, hidden tests as inputs only. */
export function forSolver(p) {
  const { hidden, ...rest } = p;
  return { ...rest, hiddenInputs: hidden.map((t) => t.args), hiddenCount: hidden.length };
}

export const summary = (p) => ({ id: p.id, number: p.number, title: p.title, difficulty: p.difficulty, tags: p.tags, contest: p.contest });

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const ident = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Validates an admin-submitted problem and returns the clean object to store. */
export function cleanProblem(input, data) {
  const fail = (m) => { throw new HttpError(422, m); };
  const title = String(input.title || '').trim();
  if (title.length < 3) fail('Give the problem a title (at least 3 characters).');
  if (!DIFFICULTIES.includes(input.difficulty)) fail('Pick a difficulty: Easy, Medium or Hard.');
  const statement = String(input.statement || '').trim();
  if (statement.length < 20) fail('The statement is too short to solve from.');
  const params = String(input.params || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!params.length || !params.every((x) => ident.test(x))) fail('Parameters must be names like nums, target.');
  const fn = { python: String(input.fnPython || '').trim(), javascript: String(input.fnJavascript || '').trim() };
  if (!ident.test(fn.python) || !ident.test(fn.javascript)) fail('Function names may use letters, digits and _ only.');

  const tests = (list, label) => (Array.isArray(list) ? list : []).map((t, i) => {
    let args, expected;
    try { args = typeof t.args === 'string' ? JSON.parse(t.args) : t.args; } catch { fail(`${label} test ${i + 1}: the input is not valid JSON.`); }
    try { expected = typeof t.expected === 'string' ? JSON.parse(t.expected) : t.expected; } catch { fail(`${label} test ${i + 1}: the expected output is not valid JSON.`); }
    if (!Array.isArray(args) || args.length !== params.length) fail(`${label} test ${i + 1}: give one value per parameter, as a JSON list like [[2,7,11], 9].`);
    if (expected === undefined) fail(`${label} test ${i + 1}: expected output is missing.`);
    return { args, expected };
  });
  const samples = tests(input.samples, 'Sample');
  const hidden = tests(input.hidden, 'Hidden');
  if (!samples.length) fail('Add at least one sample test.');
  if (!hidden.length) fail('Add at least one hidden test.');

  const all = allProblems(data);
  const existing = input.id ? all.find((p) => p.id === input.id) : null;
  let id = existing ? existing.id : slugify(title);
  if (!id) fail('Give the problem a title with letters in it.');
  if (!existing && all.some((p) => p.id === id)) fail('A problem with this title already exists.');
  const fmt = (v) => JSON.stringify(v).replace(/,/g, ', ');
  const tags = String(input.tags || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);

  return {
    id,
    number: existing ? existing.number : Math.max(...all.map((p) => p.number)) + 1,
    title, difficulty: input.difficulty, tags, contest: existing ? existing.contest : false,
    statement,
    constraints: String(input.constraints || '').split('\n').map((s) => s.trim()).filter(Boolean),
    examples: samples.map((t) => ({ input: params.map((n, j) => `${n} = ${fmt(t.args[j])}`).join(', '), output: fmt(t.expected), explanation: '' })),
    fn, params,
    starter: {
      python: `def ${fn.python}(${params.join(', ')}):\n    # write your solution here\n    pass\n`,
      javascript: `function ${fn.javascript}(${params.join(', ')}) {\n  // write your solution here\n}\n`,
    },
    samples, hidden,
    editedAt: new Date().toISOString(),
  };
}
