// GET: the live sprint: its clock, problems, the viewer's progress and the leaderboard.
import { route, respond, userFrom, publicUser } from './_lib/http.js';
import { load } from './_lib/store.js';
import { allProblems, summary } from './_lib/problems.js';
import { currentWindow, leaderboard, CONTEST_PROBLEMS } from './_lib/contest.js';

const sprintLabel = (start) => new Date(start).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' }).replace(/\s?(am|pm)/i, (m) => ' ' + m.trim().toUpperCase());

export default route(async (req, res) => {
  const data = await load();
  const user = userFrom(req);
  const win = currentWindow();
  const problems = allProblems(data);
  const names = { 'student@codearena.in': publicUser('student@codearena.in').name, 'admin@codearena.in': publicUser('admin@codearena.in').name };
  const rows = leaderboard(data.submissions, win, names, user?.email);
  const me = rows.find((r) => r.you) || null;
  respond(res, 200, {
    contest: { id: win.id, title: `${sprintLabel(win.start)} Sprint`, start: win.start, end: win.end, now: win.now, penaltyMinutes: 10 },
    problems: CONTEST_PROBLEMS.map((cp) => {
      const p = problems.find((x) => x.id === cp.id);
      const mine = me?.solved.find((s) => s.id === cp.id);
      return { ...summary(p), points: cp.points, solved: Boolean(mine?.solved), wrong: mine?.wrong || 0 };
    }),
    me,
    leaderboard: rows,
  });
});
