// Writes api/_lib/seed-problems.json: the starter problem bank.
// Each problem's expected outputs are computed here from a reference solution, so a typo in a
// hand-written answer can't slip into the hidden tests. The references never ship to the browser.
//   node scripts/make-seed.mjs
import { writeFileSync } from 'node:fs';

// small deterministic generator for the larger hidden tests
let s = 20271;
const rnd = (lo, hi) => { s = (s * 1103515245 + 12345) % 2147483648; return lo + (s % (hi - lo + 1)); };
const arr = (n, lo, hi) => Array.from({ length: n }, () => rnd(lo, hi));

const P = [];
function problem(def) { P.push(def); }

problem({
  id: 'two-sum', title: 'Two Sum', difficulty: 'Easy', tags: ['Array', 'Hash Map'],
  fn: { python: 'two_sum', javascript: 'twoSum' }, params: ['nums', 'target'],
  statement: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers that add up to \`target\`.

Each input has exactly one answer, and you may not use the same element twice. Return the two indices in increasing order.`,
  constraints: ['2 ≤ nums.length ≤ 10⁴', '-10⁹ ≤ nums[i] ≤ 10⁹', 'Exactly one valid answer exists'],
  explain: { 0: 'nums[0] + nums[1] = 2 + 7 = 9, so the answer is [0, 1].' },
  ref: (nums, target) => { const m = new Map(); for (let i = 0; i < nums.length; i++) { if (m.has(target - nums[i])) return [m.get(target - nums[i]), i]; m.set(nums[i], i); } },
  samples: [[[2, 7, 11, 15], 9], [[3, 2, 4], 6], [[3, 3], 6]],
  hidden: [[[1, 5, 9, 13], 22], [[-4, 8, 1, 0], -3], [[0, 4, 3, 0], 0], [[10, -2, 5, 7], 3], [[1000000000, 7, -1000000000], 0],
    (() => { const a = Array.from({ length: 6000 }, (_, i) => i * 3 + 1); return [a, a[4120] + a[5998]]; })()],
});

problem({
  id: 'valid-parentheses', title: 'Valid Parentheses', difficulty: 'Easy', tags: ['Stack', 'String'],
  fn: { python: 'is_valid', javascript: 'isValid' }, params: ['s'],
  statement: `Given a string \`s\` containing only the characters \`()[]{}\`, decide whether it is valid.

A string is valid when every opening bracket is closed by the same type of bracket, and brackets close in the right order.`,
  constraints: ['1 ≤ s.length ≤ 10⁴', 's contains only ()[]{}'],
  explain: { 2: 'The ( is closed by ], which is the wrong type.' },
  ref: (str) => { const st = []; const m = { ')': '(', ']': '[', '}': '{' }; for (const c of str) { if ('([{'.includes(c)) st.push(c); else if (st.pop() !== m[c]) return false; } return st.length === 0; },
  samples: [['()'], ['()[]{}'], ['(]']],
  hidden: [['([{}])'], ['(('], ['))'], ['{[]}()'], ['([)]'], [']'], ['('.repeat(5000) + ')'.repeat(5000)], ['('.repeat(5000) + ')'.repeat(4999) + ']']],
});

problem({
  id: 'reverse-words', title: 'Reverse Words in a Sentence', difficulty: 'Medium', tags: ['String', 'Two Pointers'],
  fn: { python: 'reverse_words', javascript: 'reverseWords' }, params: ['s'],
  statement: `Given a sentence \`s\`, return the words in reverse order, joined by a single space.

A word is a run of non-space characters. The input may have leading, trailing or repeated spaces; the output must not.`,
  constraints: ['1 ≤ s.length ≤ 10⁴', 's has at least one word'],
  explain: { 1: 'Extra spaces at the ends and between words are removed.' },
  ref: (str) => str.trim().split(/\s+/).reverse().join(' '),
  samples: [['the sky is blue'], ['  hello world  '], ['a good   example']],
  hidden: [['Belagavi'], ['  campus   placement   season '], ['one two'], ['x  y  z'], ['Code  Arena is  live   '], [Array.from({ length: 2000 }, (_, i) => 'w' + i).join('   ')]],
});

problem({
  id: 'chai-samosa', title: 'Chai Samosa', difficulty: 'Easy', tags: ['Math', 'Simulation'],
  fn: { python: 'chai_samosa', javascript: 'chaiSamosa' }, params: ['n'],
  statement: `A canteen counter calls out numbers from 1 to \`n\`. Return the list of what it calls:

- \`"ChaiSamosa"\` if the number is divisible by both 3 and 5,
- \`"Chai"\` if it is divisible by 3,
- \`"Samosa"\` if it is divisible by 5,
- otherwise the number itself, as a string.`,
  constraints: ['1 ≤ n ≤ 10⁴'],
  explain: { 2: '15 is divisible by both 3 and 5, so it becomes "ChaiSamosa".' },
  ref: (n) => Array.from({ length: n }, (_, i) => { const k = i + 1; return k % 15 === 0 ? 'ChaiSamosa' : k % 3 === 0 ? 'Chai' : k % 5 === 0 ? 'Samosa' : String(k); }),
  samples: [[3], [5], [15]],
  hidden: [[1], [2], [10], [30], [31], [100], [9999]],
});

problem({
  id: 'max-subarray', title: 'Maximum Subarray Sum', difficulty: 'Medium', tags: ['Array', 'Dynamic Programming'],
  fn: { python: 'max_subarray', javascript: 'maxSubarray' }, params: ['nums'],
  statement: `Given an integer array \`nums\`, find the contiguous subarray (at least one number) with the largest sum and return that sum.

An O(n) solution exists (Kadane's algorithm).`,
  constraints: ['1 ≤ nums.length ≤ 10⁵', '-10⁴ ≤ nums[i] ≤ 10⁴'],
  explain: { 0: 'The subarray [4, -1, 2, 1] has the largest sum, 6.' },
  ref: (a) => { let best = a[0], cur = a[0]; for (let i = 1; i < a.length; i++) { cur = Math.max(a[i], cur + a[i]); best = Math.max(best, cur); } return best; },
  samples: [[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], [[1]], [[5, 4, -1, 7, 8]]],
  hidden: [[[-3, -1, -2]], [[0, 0, 0]], [[2, -1, 2, -1, 2]], [[-1, 3, -2, 5, -7, 4]], [arr(20000, -10000, 10000)], [arr(20000, -50, 60)]],
});

problem({
  id: 'binary-search', title: 'Binary Search', difficulty: 'Easy', tags: ['Array', 'Binary Search'],
  fn: { python: 'search', javascript: 'search' }, params: ['nums', 'target'],
  statement: `Given a sorted array of distinct integers \`nums\` and a \`target\`, return the index of \`target\`, or \`-1\` if it is not present.

Aim for O(log n).`,
  constraints: ['1 ≤ nums.length ≤ 10⁵', 'nums is sorted in increasing order', 'all values are distinct'],
  explain: { 1: '2 is not in the array, so the answer is -1.' },
  ref: (a, t) => { let lo = 0, hi = a.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m] === t) return m; if (a[m] < t) lo = m + 1; else hi = m - 1; } return -1; },
  samples: [[[-1, 0, 3, 5, 9, 12], 9], [[-1, 0, 3, 5, 9, 12], 2]],
  hidden: [[[5], 5], [[5], -5], [[1, 3], 3], [[1, 3], 1], [[2, 4, 6, 8, 10], 11], (() => { const a = Array.from({ length: 30000 }, (_, i) => i * 2 - 15000); return [a, a[27777]]; })(), [Array.from({ length: 30000 }, (_, i) => i * 2), 29999]],
});

problem({
  id: 'valid-anagram', title: 'Valid Anagram', difficulty: 'Easy', tags: ['String', 'Hash Map', 'Sorting'],
  fn: { python: 'is_anagram', javascript: 'isAnagram' }, params: ['s', 't'],
  statement: `Given two strings \`s\` and \`t\` of lowercase letters, return \`true\` if \`t\` is an anagram of \`s\`, that is, it uses exactly the same letters the same number of times.`,
  constraints: ['1 ≤ s.length, t.length ≤ 5 × 10⁴', 'lowercase English letters only'],
  explain: { 0: 'Both words use the letters a×3, n, g, r, m.' },
  ref: (a, b) => a.length === b.length && [...a].sort().join('') === [...b].sort().join(''),
  samples: [['anagram', 'nagaram'], ['rat', 'car']],
  hidden: [['a', 'a'], ['ab', 'a'], ['listen', 'silent'], ['aabb', 'abab'], ['aabb', 'abbb'], ['belagavi', 'vigabela'], ['x'.repeat(30000) + 'y', 'y' + 'x'.repeat(30000)], ['x'.repeat(30000) + 'y', 'z' + 'x'.repeat(30000)]],
});

problem({
  id: 'rotate-matrix', title: 'Rotate Matrix', difficulty: 'Medium', tags: ['Matrix', 'Array'],
  fn: { python: 'rotate', javascript: 'rotate' }, params: ['matrix'],
  statement: `Given an \`n × n\` matrix, return it rotated by 90 degrees clockwise.

Return the rotated matrix (a new one, or the same one changed in place).`,
  constraints: ['1 ≤ n ≤ 200', '-1000 ≤ matrix[i][j] ≤ 1000'],
  explain: { 0: 'The first column, read bottom to top, becomes the first row.' },
  ref: (m) => m[0].map((_, j) => m.map((row) => row[j]).reverse()),
  samples: [[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [[[5, 1, 9, 11], [2, 4, 8, 10], [13, 3, 6, 7], [15, 14, 12, 16]]]],
  hidden: [[[[1]]], [[[1, 2], [3, 4]]], [[[0, -1], [-2, 3]]], [Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => i * 5 + j))], [Array.from({ length: 80 }, () => arr(80, -1000, 1000))]],
});

problem({
  id: 'longest-unique-substring', title: 'Longest Substring Without Repeats', difficulty: 'Medium', tags: ['String', 'Sliding Window', 'Hash Map'],
  fn: { python: 'longest_unique', javascript: 'longestUnique' }, params: ['s'],
  statement: `Given a string \`s\`, return the length of the longest substring that has no repeated characters.`,
  constraints: ['0 ≤ s.length ≤ 5 × 10⁴', 's has letters, digits, symbols and spaces'],
  explain: { 0: 'The answer is "abc", with length 3.' },
  ref: (str) => { const last = new Map(); let best = 0, start = 0; [...str].forEach((c, i) => { if (last.has(c) && last.get(c) >= start) start = last.get(c) + 1; last.set(c, i); best = Math.max(best, i - start + 1); }); return best; },
  samples: [['abcabcbb'], ['bbbbb'], ['pwwkew']],
  hidden: [[''], [' '], ['au'], ['dvdf'], ['abba'], ['tmmzuxt'], [Array.from({ length: 20000 }, () => String.fromCharCode(rnd(97, 122))).join('')]],
});

problem({
  id: 'merge-intervals', title: 'Merge Intervals', difficulty: 'Medium', tags: ['Array', 'Sorting'],
  fn: { python: 'merge', javascript: 'merge' }, params: ['intervals'],
  statement: `Given a list of intervals \`[start, end]\`, merge all overlapping intervals and return the result sorted by start.

Intervals that touch, like \`[1, 4]\` and \`[4, 5]\`, count as overlapping.`,
  constraints: ['1 ≤ intervals.length ≤ 10⁴', '0 ≤ start ≤ end ≤ 10⁴'],
  explain: { 0: '[1, 3] and [2, 6] overlap, so they merge into [1, 6].' },
  ref: (iv) => { const a = iv.map((x) => [...x]).sort((p, q) => p[0] - q[0]); const out = []; for (const [st, en] of a) { if (out.length && st <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], en); else out.push([st, en]); } return out; },
  samples: [[[[1, 3], [2, 6], [8, 10], [15, 18]]], [[[1, 4], [4, 5]]]],
  hidden: [[[[1, 4]]], [[[1, 4], [0, 4]]], [[[1, 4], [2, 3]]], [[[5, 7], [1, 2], [3, 4]]], [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]], [Array.from({ length: 8000 }, () => { const a = rnd(0, 9900); return [a, a + rnd(0, 6)]; })]],
});

problem({
  id: 'trapping-rain-water', title: 'Trapping Rain Water', difficulty: 'Hard', tags: ['Array', 'Two Pointers'],
  fn: { python: 'trap', javascript: 'trap' }, params: ['height'],
  statement: `Monsoon is here. \`height[i]\` is the height of a wall of width 1 at position \`i\`. Return how many units of rain water are trapped between the walls after it rains.`,
  constraints: ['1 ≤ height.length ≤ 10⁵', '0 ≤ height[i] ≤ 10⁵'],
  explain: { 0: 'Six units of water sit in the dips between the walls.' },
  ref: (h) => { let l = 0, r = h.length - 1, lm = 0, rm = 0, w = 0; while (l < r) { if (h[l] < h[r]) { lm = Math.max(lm, h[l]); w += lm - h[l]; l++; } else { rm = Math.max(rm, h[r]); w += rm - h[r]; r--; } } return w; },
  samples: [[[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], [[4, 2, 0, 3, 2, 5]]],
  hidden: [[[1]], [[3, 0]], [[2, 0, 2]], [[5, 4, 3, 2, 1]], [[1, 2, 3, 4, 5]], [[5, 0, 0, 0, 5]], [arr(30000, 0, 10000)]],
});

problem({
  id: 'edit-distance', title: 'Edit Distance', difficulty: 'Hard', tags: ['String', 'Dynamic Programming'],
  fn: { python: 'min_distance', javascript: 'minDistance' }, params: ['word1', 'word2'],
  statement: `Return the minimum number of operations needed to turn \`word1\` into \`word2\`. One operation inserts a character, deletes a character, or replaces a character.`,
  constraints: ['0 ≤ word1.length, word2.length ≤ 500', 'lowercase English letters'],
  explain: { 0: 'horse → rorse (replace h) → rose (delete r) → ros (delete e).' },
  ref: (a, b) => { const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) dp[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]); return dp[a.length][b.length]; },
  samples: [['horse', 'ros'], ['intention', 'execution']],
  hidden: [['', ''], ['', 'abc'], ['abc', ''], ['kitten', 'sitting'], ['belgaum', 'belagavi'], ['same', 'same'], [Array.from({ length: 400 }, () => String.fromCharCode(rnd(97, 100))).join(''), Array.from({ length: 450 }, () => String.fromCharCode(rnd(97, 100))).join('')]],
});

// ---- contest set ----
problem({
  id: 'placement-shortlist', title: 'Placement Shortlist', difficulty: 'Easy', tags: ['Array', 'Sorting'], contest: true,
  fn: { python: 'shortlist', javascript: 'shortlist' }, params: ['scores', 'k'],
  statement: `A company shortlists the top \`k\` scorers of an aptitude test, but anyone who ties with the \`k\`-th highest score is shortlisted too.

Given the \`scores\` and \`k\`, return how many students are shortlisted.`,
  constraints: ['1 ≤ k ≤ scores.length ≤ 10⁵', '0 ≤ scores[i] ≤ 100'],
  explain: { 0: 'The 3rd highest score is 80, and two students have 80, so 4 are shortlisted.' },
  ref: (sc, k) => { const cut = [...sc].sort((a, b) => b - a)[k - 1]; return sc.filter((x) => x >= cut).length; },
  samples: [[[90, 80, 95, 80, 60], 3], [[50, 50, 50], 1]],
  hidden: [[[70], 1], [[10, 20, 30, 40], 4], [[10, 20, 30, 40], 2], [[100, 99, 99, 98, 98, 98], 3], [arr(20000, 0, 100), 1200]],
});

problem({
  id: 'minimum-platforms', title: 'Minimum Platforms', difficulty: 'Medium', tags: ['Greedy', 'Sorting'], contest: true,
  fn: { python: 'min_platforms', javascript: 'minPlatforms' }, params: ['arrivals', 'departures'],
  statement: `Belagavi station gets \`n\` trains a day. Train \`i\` arrives at \`arrivals[i]\` and leaves at \`departures[i]\` (times as HHMM numbers, e.g. \`930\` is 9:30).

Return the minimum number of platforms so that no train waits. A train that arrives at the same minute another leaves still needs its own platform.`,
  constraints: ['1 ≤ n ≤ 5 × 10⁴', '0 ≤ arrivals[i] ≤ departures[i] ≤ 2359'],
  explain: { 0: 'Between 9:40 and 12:00 three trains are at the station at once.' },
  ref: (a, d) => { const A = [...a].sort((x, y) => x - y), D = [...d].sort((x, y) => x - y); let i = 0, j = 0, cur = 0, best = 0; while (i < A.length) { if (A[i] <= D[j]) { cur++; i++; best = Math.max(best, cur); } else { cur--; j++; } } return best; },
  samples: [[[900, 940, 950, 1100, 1500, 1800], [910, 1200, 1120, 1130, 1900, 2000]], [[900, 1100], [1000, 1200]]],
  hidden: [[[1000], [1030]], [[900, 1000], [1000, 1100]], [[100, 100, 100], [200, 200, 200]], [[900, 905, 910, 915], [2000, 1000, 930, 916]],
    (() => { const a = arr(10000, 0, 2200); return [a, a.map((x) => Math.min(2359, x + rnd(0, 150)))]; })()],
});

problem({
  id: 'smallest-window', title: 'Smallest Window With All Letters', difficulty: 'Hard', tags: ['String', 'Sliding Window'], contest: true,
  fn: { python: 'min_window', javascript: 'minWindow' }, params: ['s', 't'],
  statement: `Given strings \`s\` and \`t\`, return the shortest substring of \`s\` that contains every character of \`t\` (counting repeats). If there is none, return \`""\`.

If several windows have the same smallest length, return the one that starts first.`,
  constraints: ['1 ≤ s.length, t.length ≤ 10⁵', 'letters only'],
  explain: { 0: '"BANC" contains A, B and C and nothing shorter does.' },
  ref: (str, t) => { const need = new Map(); for (const c of t) need.set(c, (need.get(c) || 0) + 1); let missing = t.length, l = 0, best = [0, Infinity]; for (let r = 0; r < str.length; r++) { const c = str[r]; if (need.has(c)) { if (need.get(c) > 0) missing--; need.set(c, need.get(c) - 1); } while (missing === 0) { if (r - l < best[1] - best[0]) best = [l, r]; const lc = str[l]; if (need.has(lc)) { need.set(lc, need.get(lc) + 1); if (need.get(lc) > 0) missing++; } l++; } } return best[1] === Infinity ? '' : str.slice(best[0], best[1] + 1); },
  samples: [['ADOBECODEBANC', 'ABC'], ['a', 'a'], ['a', 'aa']],
  hidden: [['ab', 'b'], ['aa', 'aa'], ['bba', 'ab'], ['abcdebdde', 'bde'], ['xyz', 'q'], [Array.from({ length: 30000 }, () => String.fromCharCode(rnd(97, 106))).join(''), 'jihgfedcbaj']],
});

const STARTER_PY = (p) => `def ${p.fn.python}(${p.params.join(', ')}):\n    # write your solution here\n    pass\n`;
const STARTER_JS = (p) => `function ${p.fn.javascript}(${p.params.join(', ')}) {\n  // write your solution here\n}\n`;
const fmt = (v) => JSON.stringify(v).replace(/,/g, ', ');

const out = P.map((p, i) => {
  const make = (args) => ({ args, expected: p.ref(...structuredClone(args)) });
  const samples = p.samples.map(make);
  return {
    id: p.id, number: i + 1, title: p.title, difficulty: p.difficulty, tags: p.tags, contest: Boolean(p.contest),
    statement: p.statement, constraints: p.constraints,
    examples: samples.map((t, k) => ({ input: p.params.map((n, j) => `${n} = ${fmt(t.args[j])}`).join(', '), output: fmt(t.expected), explanation: p.explain[k] || '' })),
    fn: p.fn, params: p.params,
    starter: { python: STARTER_PY(p), javascript: STARTER_JS(p) },
    samples, hidden: p.hidden.map(make),
  };
});
writeFileSync('api/_lib/seed-problems.json', JSON.stringify(out));
console.log(out.length, 'problems,', out.reduce((n, p) => n + p.hidden.length, 0), 'hidden tests');
