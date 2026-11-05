// GET: the viewer's submissions (newest first). ?problem=id narrows it to one problem,
// ?id=… returns one submission with its code. The admin gets everyone's with ?all=1.
import { route, respond, requireUser, publicUser, HttpError } from './_lib/http.js';
import { load } from './_lib/store.js';
import { allProblems } from './_lib/problems.js';

export default route(async (req, res) => {
  const user = requireUser(req);
  const data = await load();
  const titles = Object.fromEntries(allProblems(data).map((p) => [p.id, { title: p.title, difficulty: p.difficulty }]));
  const all = req.query.all === '1';
  if (all && user.role !== 'admin') throw new HttpError(403, 'Only the admin account can see everyone\'s submissions.');

  if (req.query.id) {
    const s = data.submissions.find((x) => x.id === req.query.id);
    if (!s || (s.email !== user.email && user.role !== 'admin')) throw new HttpError(404, 'Submission not found.');
    return respond(res, 200, { submission: { ...s, ...titles[s.problemId], user: publicUser(s.email)?.name || s.email } });
  }

  let list = data.submissions.filter((s) => (all ? !s.sample : s.email === user.email));
  if (req.query.problem) list = list.filter((s) => s.problemId === req.query.problem);
  list = list.slice().reverse().slice(0, Number(req.query.limit) || 200).map(({ code, ...s }) => ({
    ...s, ...titles[s.problemId], user: publicUser(s.email)?.name || s.email, hasCode: Boolean(code),
  }));
  respond(res, 200, { submissions: list });
});
