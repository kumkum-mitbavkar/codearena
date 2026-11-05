// Rolling two-hour contests. A new sprint starts every two hours (on the even hour, IST),
// so there is always one live. Sample players solve on a fixed, seeded schedule through the
// window, which keeps the leaderboard moving and makes it the same for everyone.
const WINDOW = 2 * 3600e3;
const IST = 5.5 * 3600e3;
const FIRST = Math.floor((Date.UTC(2026, 0, 1) + IST) / WINDOW);
export const CONTEST_PROBLEMS = [
  { id: 'placement-shortlist', points: 100 },
  { id: 'minimum-platforms', points: 200 },
  { id: 'smallest-window', points: 300 },
];
const PENALTY_MIN = 10; // minutes added for each wrong try before an accepted one

const PLAYERS = [
  ['Rohan Kulkarni', 0.95], ['Sneha Desai', 0.9], ['Arjun Hegde', 0.86], ['Pooja Naik', 0.8], ['Vikram Joshi', 0.76],
  ['Ananya Shetty', 0.72], ['Karthik Rao', 0.66], ['Meera Patil', 0.62], ['Sameer Mulla', 0.55], ['Divya Kamat', 0.5],
  ['Rahul Gouda', 0.45], ['Shreya Bhat', 0.4], ['Nikhil Pawar', 0.33], ['Fatima Shaikh', 0.28],
];

export function currentWindow(now = Date.now()) {
  const index = Math.floor((now + IST) / WINDOW);
  const start = index * WINDOW - IST;
  return { id: `sprint-${index}`, number: index - FIRST + 1, start, end: start + WINDOW, now };
}

function samplePlayers(win) {
  let seed = Number(win.id.replace(/\D/g, '')) % 2147483646 + 1;
  const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const length = win.end - win.start;
  return PLAYERS.map(([name, skill]) => {
    const solves = {};
    let clock = 0.04 + rnd() * 0.1;
    CONTEST_PROBLEMS.forEach((cp, i) => {
      const chance = skill - i * 0.22 + (rnd() - 0.5) * 0.2;
      if (rnd() > chance) return;
      clock += (0.08 + rnd() * 0.22) * (1 + i * 0.6) * (1.25 - skill * 0.5);
      if (clock > 0.97) return;
      solves[cp.id] = { at: win.start + clock * length, wrong: Math.floor(rnd() * (2.6 - skill * 2)) };
    });
    return { name, sample: true, solves };
  });
}

function scoreOf(solves, win) {
  let points = 0, penalty = 0, last = 0;
  for (const cp of CONTEST_PROBLEMS) {
    const s = solves[cp.id];
    if (!s || s.at > win.now) continue;
    points += cp.points;
    const minutes = Math.floor((s.at - win.start) / 60e3);
    penalty += minutes + s.wrong * PENALTY_MIN;
    last = Math.max(last, s.at);
  }
  return { points, penalty, last };
}

/** Real users' contest results, read from their contest submissions in this window. */
function realPlayers(submissions, win, names) {
  const byUser = {};
  for (const s of submissions) {
    if (s.contest !== win.id) continue;
    const u = (byUser[s.email] ||= {});
    const p = (u[s.problemId] ||= { wrong: 0, at: null });
    if (p.at) continue;
    if (s.verdict === 'Accepted') p.at = Date.parse(s.at); else p.wrong += 1;
  }
  return Object.entries(byUser).map(([email, probs]) => {
    const solves = {};
    const tries = {};
    for (const [id, p] of Object.entries(probs)) { tries[id] = p.wrong; if (p.at) solves[id] = { at: p.at, wrong: p.wrong }; }
    return { name: names[email] || email, email, sample: false, solves, tries };
  });
}

export function leaderboard(submissions, win, names, viewerEmail) {
  const players = [...samplePlayers(win), ...realPlayers(submissions, win, names)];
  const rows = players.map((p) => {
    const score = scoreOf(p.solves, win);
    const solved = CONTEST_PROBLEMS.map((cp) => {
      const s = p.solves[cp.id];
      if (s && s.at <= win.now) return { id: cp.id, solved: true, minute: Math.floor((s.at - win.start) / 60e3), wrong: s.wrong };
      return { id: cp.id, solved: false, wrong: p.tries ? p.tries[cp.id] || 0 : 0 };
    });
    return { name: p.name, sample: p.sample, you: Boolean(viewerEmail) && p.email === viewerEmail, points: score.points, penalty: score.penalty, last: score.last, solved };
  });
  rows.sort((a, b) => b.points - a.points || a.penalty - b.penalty || a.last - b.last || a.name.localeCompare(b.name));
  let rank = 0;
  rows.forEach((r, i) => { rank = i > 0 && r.points === rows[i - 1].points && r.penalty === rows[i - 1].penalty ? rank : i + 1; r.rank = rank; });
  return rows;
}
