// GET: the problem list with acceptance rates and, when signed in, the viewer's solved state.
import { route, respond, userFrom } from './_lib/http.js';
import { load } from './_lib/store.js';
import { allProblems, summary } from './_lib/problems.js';

export default route(async (req, res) => {
  const data = await load();
  const user = userFrom(req);
  const stats = {};
  for (const s of data.submissions) {
    const st = (stats[s.problemId] ||= { tries: 0, ok: 0, solved: false, tried: false });
    st.tries += 1;
    if (s.verdict === 'Accepted') st.ok += 1;
    if (user && s.email === user.email) { st.tried = true; if (s.verdict === 'Accepted') st.solved = true; }
  }
  const problems = allProblems(data).map((p) => {
    const st = stats[p.id] || { tries: 0, ok: 0 };
    return {
      ...summary(p),
      acceptance: st.tries ? Math.round((st.ok / st.tries) * 100) : null,
      status: st.solved ? 'solved' : st.tried ? 'attempted' : null,
    };
  });
  // headline numbers and a day-by-day activity strip for the landing page (sample history included, labelled there)
  const since = Date.now() - 140 * 864e5;
  const activity = {};
  let accepted = 0;
  for (const s of data.submissions) {
    if (s.verdict === 'Accepted') accepted += 1;
    const t = Date.parse(s.at);
    if (t >= since) { const day = new Date(t + 5.5 * 3600e3).toISOString().slice(0, 10); activity[day] = (activity[day] || 0) + 1; }
  }
  respond(res, 200, { problems, totals: { submissions: data.submissions.length, accepted }, activity });
});
