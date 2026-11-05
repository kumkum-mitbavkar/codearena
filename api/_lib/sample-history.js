// Practice history for the demo student, so the profile heatmap and stats have something to show
// on a first visit. Every entry is flagged `sample` and the profile labels it as sample activity.
const DAY = 864e5;
const SOLVED = ['valid-parentheses', 'chai-samosa', 'binary-search', 'valid-anagram', 'reverse-words', 'merge-intervals'];
const TRIED = ['longest-unique-substring', 'trapping-rain-water'];
const VERDICTS = ['Wrong Answer', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded'];

export function sampleHistory(now) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const out = [];
  let solvedIndex = 0;
  for (let back = 150; back >= 1; back--) {
    // practice comes in runs, heavier in the last month, like a real placement season
    const chance = back < 35 ? 0.62 : back < 90 ? 0.34 : 0.16;
    if (rnd() > chance) continue;
    const count = 1 + Math.floor(rnd() * (back < 35 ? 4 : 2));
    for (let k = 0; k < count; k++) {
      const at = now - back * DAY + Math.floor((9 + rnd() * 13) * 3600e3);
      const solving = solvedIndex < SOLVED.length && rnd() < 0.12;
      const problemId = solving ? SOLVED[solvedIndex++] : [...SOLVED.slice(0, Math.max(1, solvedIndex)), ...TRIED][Math.floor(rnd() * (Math.max(1, solvedIndex) + TRIED.length))];
      const accepted = solving || (SOLVED.includes(problemId) && SOLVED.indexOf(problemId) < solvedIndex && rnd() < 0.55);
      out.push({
        id: 'sample-' + out.length,
        email: 'student@codearena.in',
        problemId,
        lang: rnd() < 0.6 ? 'python' : 'javascript',
        verdict: accepted ? 'Accepted' : VERDICTS[Math.floor(rnd() * VERDICTS.length)],
        passed: null,
        total: null,
        runtimeMs: accepted ? Math.round(20 + rnd() * 140) : null,
        at: new Date(at).toISOString(),
        sample: true,
      });
    }
  }
  // anything not reached by chance is solved in the last few days
  while (solvedIndex < SOLVED.length) {
    out.push({ id: 'sample-' + out.length, email: 'student@codearena.in', problemId: SOLVED[solvedIndex++], lang: 'python', verdict: 'Accepted', passed: null, total: null, runtimeMs: 48, at: new Date(now - (8 - solvedIndex) * DAY).toISOString(), sample: true });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
