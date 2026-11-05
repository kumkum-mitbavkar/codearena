// GET: the signed-in user's stats: solved by difficulty, streaks and a day-by-day heatmap.
import { route, respond, requireUser } from './_lib/http.js';
import { load } from './_lib/store.js';
import { allProblems } from './_lib/problems.js';
import { streaks } from './_lib/stats.js';

const IST = 5.5 * 3600e3;
const dayKey = (t) => new Date(Date.parse(t) + IST).toISOString().slice(0, 10);

export default route(async (req, res) => {
  const user = requireUser(req);
  const data = await load();
  const problems = allProblems(data);
  const mine = data.submissions.filter((s) => s.email === user.email);
  const solved = new Set(mine.filter((s) => s.verdict === 'Accepted').map((s) => s.problemId));
  const byDifficulty = ['Easy', 'Medium', 'Hard'].map((d) => ({
    difficulty: d,
    total: problems.filter((p) => p.difficulty === d).length,
    solved: problems.filter((p) => p.difficulty === d && solved.has(p.id)).length,
  }));
  const heat = {};
  for (const s of mine) heat[dayKey(s.at)] = (heat[dayKey(s.at)] || 0) + 1;
  const today = dayKey(new Date().toISOString());
  const accepted = mine.filter((s) => s.verdict === 'Accepted').length;
  const langs = { python: 0, javascript: 0 };
  for (const s of mine) langs[s.lang] = (langs[s.lang] || 0) + 1;
  const titles = Object.fromEntries(problems.map((p) => [p.id, p.title]));
  const recent = [];
  for (const s of mine.slice().reverse()) {
    if (s.verdict === 'Accepted' && !recent.some((r) => r.problemId === s.problemId)) recent.push({ problemId: s.problemId, title: titles[s.problemId], at: s.at, lang: s.lang, sample: Boolean(s.sample) });
    if (recent.length === 6) break;
  }
  respond(res, 200, {
    user,
    solved: solved.size,
    totalProblems: problems.length,
    byDifficulty,
    submissions: mine.length,
    acceptance: mine.length ? Math.round((accepted / mine.length) * 100) : 0,
    langs,
    heat,
    today,
    streak: streaks(Object.keys(heat), today),
    hasSample: mine.some((s) => s.sample),
    recent,
  });
});
