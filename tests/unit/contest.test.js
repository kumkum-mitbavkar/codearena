import test from 'node:test';
import assert from 'node:assert/strict';
import { currentWindow, leaderboard, CONTEST_PROBLEMS } from '../../api/_lib/contest.js';
import { streaks } from '../../api/_lib/stats.js';

test('a sprint is two hours long and starts on an even IST hour', () => {
  const w = currentWindow(Date.parse('2026-11-03T11:30:00Z')); // 17:00 IST
  assert.equal(w.end - w.start, 2 * 3600e3);
  assert.equal(new Date(w.start + 5.5 * 3600e3).getUTCHours() % 2, 0);
  assert.ok(w.start <= w.now && w.now < w.end);
});

test('sample players only show solves that have happened by now', () => {
  const w = currentWindow(Date.parse('2026-11-03T11:30:00Z'));
  const early = leaderboard([], { ...w, now: w.start + 60e3 }, {}, null);
  const late = leaderboard([], { ...w, now: w.end - 1 }, {}, null);
  assert.ok(early.every((r) => r.points === 0));
  assert.ok(late.some((r) => r.points > 0));
  assert.ok(late.every((r) => r.sample));
});

test('a real accepted contest submission scores points with penalties', () => {
  const w = currentWindow(Date.parse('2026-11-03T11:30:00Z'));
  const at = (min) => new Date(w.start + min * 60e3).toISOString();
  const subs = [
    { email: 'me@x', problemId: 'placement-shortlist', verdict: 'Wrong Answer', at: at(5), contest: w.id },
    { email: 'me@x', problemId: 'placement-shortlist', verdict: 'Accepted', at: at(12), contest: w.id },
    { email: 'me@x', problemId: 'minimum-platforms', verdict: 'Accepted', at: at(30), contest: 'sprint-0' }, // another sprint
  ];
  const rows = leaderboard(subs, { ...w, now: w.start + 60 * 60e3 }, { 'me@x': 'Me' }, 'me@x');
  const me = rows.find((r) => r.you);
  assert.equal(me.points, CONTEST_PROBLEMS[0].points);
  assert.equal(me.penalty, 12 + 10);
  assert.equal(me.name, 'Me');
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].points >= r.points));
});

test('streaks count consecutive days and survive until the end of the next day', () => {
  assert.deepEqual(streaks(['2026-11-01', '2026-11-02', '2026-11-03'], '2026-11-03'), { current: 3, longest: 3 });
  assert.deepEqual(streaks(['2026-11-01', '2026-11-02'], '2026-11-03'), { current: 2, longest: 2 });
  assert.deepEqual(streaks(['2026-10-01', '2026-10-02', '2026-10-03', '2026-11-01'], '2026-11-03'), { current: 0, longest: 3 });
});
