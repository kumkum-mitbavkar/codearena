// POST { problemId, lang, code, results, stop, contest }: judge a submission and store it.
import crypto from 'node:crypto';
import { route, respond, readJson, requireUser, HttpError } from './_lib/http.js';
import { load, save } from './_lib/store.js';
import { findProblem } from './_lib/problems.js';
import { judge } from './_lib/judge.js';
import { currentWindow, CONTEST_PROBLEMS } from './_lib/contest.js';

export default route(async (req, res) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const user = requireUser(req);
  const body = readJson(req);
  if (!['python', 'javascript'].includes(body.lang)) throw new HttpError(422, 'Pick Python or JavaScript.');
  const code = String(body.code || '');
  if (!code.trim()) throw new HttpError(422, 'Write some code before submitting.');
  if (code.length > 50000) throw new HttpError(422, 'That solution is too long (50,000 characters max).');

  const data = await load();
  const problem = findProblem(data, String(body.problemId));
  const result = judge(problem, { lang: body.lang, code, results: body.results, stop: body.stop });

  const win = currentWindow();
  const inContest = Boolean(body.contest) && CONTEST_PROBLEMS.some((c) => c.id === problem.id);
  const submission = {
    id: crypto.randomUUID(),
    email: user.email,
    problemId: problem.id,
    lang: body.lang,
    verdict: result.verdict,
    passed: result.passed,
    total: result.total,
    runtimeMs: result.verdict === 'Accepted' ? result.runtimeMs : null,
    checkedOnServer: result.checkedOnServer,
    code,
    at: new Date().toISOString(),
    ...(inContest ? { contest: win.id } : {}),
  };
  data.submissions.push(submission);
  await save(data);
  const { code: _omit, ...stored } = submission;
  respond(res, 200, { submission: stored, ...result });
});
