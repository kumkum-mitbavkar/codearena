// GET ?id=two-sum: one problem as the solver sees it (hidden tests without their answers).
import { route, respond, userFrom, HttpError } from './_lib/http.js';
import { load } from './_lib/store.js';
import { findProblem, forSolver } from './_lib/problems.js';
import { LIMITS } from './_lib/judge.js';

export default route(async (req, res) => {
  if (!req.query.id) throw new HttpError(400, 'Which problem?');
  const data = await load();
  const user = userFrom(req);
  const problem = findProblem(data, String(req.query.id));
  const solved = Boolean(user) && data.submissions.some((s) => s.email === user.email && s.problemId === problem.id && s.verdict === 'Accepted');
  respond(res, 200, { problem: forSolver(problem), limits: LIMITS, solved });
});
