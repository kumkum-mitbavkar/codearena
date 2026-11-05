// Admin only.
//   GET               every problem with its hidden tests, plus the latest submissions
//   GET ?id=…         one problem in full
//   POST {problem}    create or update a problem
//   POST {action:'reset'}  back to the starter data
import { route, respond, readJson, requireAdmin, publicUser, HttpError } from './_lib/http.js';
import { load, save, reset } from './_lib/store.js';
import { allProblems, findProblem, cleanProblem } from './_lib/problems.js';

export default route(async (req, res) => {
  requireAdmin(req);
  if (req.method === 'GET') {
    const data = await load();
    if (req.query.id) return respond(res, 200, { problem: findProblem(data, String(req.query.id)) });
    const problems = allProblems(data);
    const titles = Object.fromEntries(problems.map((p) => [p.id, p.title]));
    const real = data.submissions.filter((s) => !s.sample);
    const day = Date.now() - 864e5;
    return respond(res, 200, {
      problems: problems.map((p) => ({ id: p.id, number: p.number, title: p.title, difficulty: p.difficulty, tags: p.tags, samples: p.samples.length, hidden: p.hidden.length, edited: Boolean(p.editedAt), contest: p.contest })),
      submissions: real.slice(-40).reverse().map(({ code, ...s }) => ({ ...s, title: titles[s.problemId] || s.problemId, user: publicUser(s.email)?.name || s.email })),
      totals: {
        submissions: real.length,
        today: real.filter((s) => Date.parse(s.at) > day).length,
        accepted: real.filter((s) => s.verdict === 'Accepted').length,
      },
    });
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const body = readJson(req);
  if (body.action === 'reset') {
    await reset();
    return respond(res, 200, { ok: true });
  }
  const data = await load();
  const problem = cleanProblem(body.problem || {}, data);
  data.problems[problem.id] = problem;
  await save(data);
  respond(res, 200, { problem });
});
