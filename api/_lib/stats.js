// Day-streaks from a list of YYYY-MM-DD keys (IST days with at least one submission).
export function streaks(days, today) {
  const set = new Set(days);
  const step = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  let current = 0;
  // a streak is still alive if you practised today or yesterday
  let cursor = set.has(today) ? today : step(today, -1);
  while (set.has(cursor)) { current += 1; cursor = step(cursor, -1); }
  let longest = 0, run = 0, prev = null;
  for (const d of [...set].sort()) {
    run = prev && step(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}
