# Browser walk-through of every CodeArena flow at phone (390x844) and desktop (1440x900).
#
# Starts its own dev server per viewport on a fresh data folder, then clicks through:
# filters, logged-out run, sign-in, Python and JavaScript solves to Accepted, a wrong answer,
# a runtime error, endless loops ending as Time Limit Exceeded (Python and JS), submissions,
# profile, the live sprint and leaderboard, and the admin add/edit problem flow.
# Fails on any console error or sideways scroll.
#
#     python3 tests/e2e/run.py            # both viewports
#     python3 tests/e2e/run.py phone      # one
#     CODEARENA_BASE=https://… python3 tests/e2e/run.py   # against a deployed site
#         (it adds a "Sum of Digits" problem and submissions; use Admin > Reset demo data afterwards)
import asyncio, os, re, shutil, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'e2e' / 'out'
VIEWPORTS = {'desktop': {'width': 1440, 'height': 900}, 'phone': {'width': 390, 'height': 844}}

PY_TWO_SUM = '''def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
'''
JS_TWO_SUM = '''function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
    seen.set(nums[i], i);
  }
}
'''
JS_WRONG = 'function maxSubarray(nums) {\n  return Math.max(...nums);\n}\n'
JS_THROWS = 'function isValid(s) {\n  return s.chars.length === 0;\n}\n'
PY_LOOP = 'def search(nums, target):\n    while True:\n        pass\n'
JS_LOOP = 'function search(nums, target) {\n  while (true) {}\n}\n'
PY_SEARCH = '''def search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
'''
JS_SHORTLIST = '''function shortlist(scores, k) {
  const cut = [...scores].sort((a, b) => b - a)[k - 1];
  return scores.filter((s) => s >= cut).length;
}
'''
JS_DIGITS = "function digitSum(n) {\n  return String(n).split('').reduce((a, d) => a + Number(d), 0);\n}\n"


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close(); return port


class Run:
    def __init__(self, name):
        self.name, self.passed, self.failed, self.errors = name, 0, [], []

    def check(self, ok, label):
        if ok:
            self.passed += 1
            print(f'  ok   {label}')
        else:
            self.failed.append(label)
            print(f'  FAIL {label}')


async def flow(pw, name, vp):
    port = free_port()
    data_dir = tempfile.mkdtemp(prefix='codearena-e2e-')
    env = {**os.environ, 'CODEARENA_DATA_DIR': data_dir}
    env.pop('DATA_READ_WRITE_TOKEN', None)
    log = open(OUT / f'server-{name}.log', 'w')
    live = os.environ.get('CODEARENA_BASE')
    server = None if live else subprocess.Popen(['node', 'scripts/dev-server.mjs', str(port)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    base = live.rstrip('/') if live else f'http://127.0.0.1:{port}'
    for _ in range(0 if live else 50):
        try:
            socket.create_connection(('127.0.0.1', port), timeout=0.2).close(); break
        except OSError:
            time.sleep(0.1)

    r = Run(name)
    phone = name == 'phone'
    browser = await pw.chromium.launch()
    ctx = await browser.new_context(viewport=vp, device_scale_factor=2 if phone else 1, has_touch=phone, is_mobile=phone)
    page = await ctx.new_page()
    page.set_default_timeout(20000)
    page.on('console', lambda m: r.errors.append(f'console: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: r.errors.append(f'pageerror: {e}'))

    async def no_sideways(label):
        sw = await page.evaluate('document.documentElement.scrollWidth')
        r.check(sw <= vp['width'], f'no sideways scroll on {label} ({sw}px)')

    async def shot(label):
        await page.screenshot(path=str(OUT / f'{name}-{label}.png'))

    async def open_code():
        if phone:
            await page.click('.ws-tabs [data-view=code]')

    async def set_code(code):
        await open_code()
        await page.click('.cm-content')
        await page.keyboard.press('ControlOrMeta+a')
        await page.keyboard.press('Delete')
        await page.keyboard.insert_text(code)

    async def choose_lang(lang):
        await open_code()
        await page.select_option('#lang', lang)

    async def act(what):
        await page.locator(f'[data-act={what}]:visible').first.click()

    async def verdict(timeout=60000):
        h = page.locator('#console-body .verdict h2')
        await expect(page.locator('[data-act=run]:visible').first).to_be_enabled(timeout=timeout)
        await h.wait_for(timeout=timeout)
        return (await h.inner_text()).strip()

    try:
        # ---------- home + filters (logged out) ----------
        await page.goto(base + '/')
        await page.wait_for_selector('.l-title')
        r.check('Get the verdict' in await page.inner_text('.l-title'), 'landing hero shows')
        await page.wait_for_selector('#st-problems[data-count]')
        r.check(await page.get_attribute('#st-problems', 'data-count') == '15', 'landing counts 15 problems from the app')
        await page.wait_for_selector('.mo-ac', timeout=25000)
        r.check('Accepted' in await page.inner_text('.mo-ac'), 'editor demo types a solution and reaches Accepted')
        r.check(await page.locator('#l-board li').count() >= 5, 'landing shows the live leaderboard')
        await no_sideways('landing')
        await shot('landing')
        await page.click('#start-solving')
        await page.wait_for_selector('a.prow')
        r.check(page.url.rstrip('/').endswith('/problems'), 'Start solving opens the problem list')
        r.check(await page.locator('.prow').count() == 15, 'problem list shows 15 problems')
        r.check(await page.locator('.contest-card .live-dot').count() == 1, 'live sprint card on home')
        await page.fill('#q', 'anagram')
        r.check(await page.locator('.prow').count() == 1, 'search narrows to Valid Anagram')
        await page.fill('#q', '')
        await page.click('[data-diff=Hard]')
        r.check(await page.locator('.prow').count() == 3, 'Hard filter shows 3 problems')
        await page.click('[data-diff=All]')
        await page.click('[data-topic="Dynamic Programming"]')
        titles = await page.locator('.prow .title').all_inner_texts()
        r.check(len(titles) == 2 and any('Edit Distance' in t for t in titles), 'topic chip filters to Dynamic Programming')
        await page.click('[data-topic="Dynamic Programming"]')
        await no_sideways('home')
        await shot('home')

        # ---------- logged-out run, then submit asks for sign-in ----------
        await page.click('a.prow[href="/problems/two-sum"]')
        await page.wait_for_selector('.statement h1')
        r.check('Two Sum' in await page.inner_text('.statement h1'), 'problem page opens from the list')
        await choose_lang('javascript')
        await set_code(JS_TWO_SUM)
        await act('run')
        r.check(await verdict() == 'Sample cases passed', 'logged-out Run works (JavaScript)')
        await act('submit')
        await page.wait_for_url(re.compile(r'/login'))
        r.check(True, 'Submit while logged out goes to sign-in')

        # ---------- sign in ----------
        await page.fill('input[name=email]', 'student@codearena.in')
        await page.fill('input[name=password]', 'wrong-password')
        await page.click('button[type=submit]')
        await page.wait_for_selector('#login-error:not([hidden])')
        r.check('do not match' in await page.inner_text('#login-error'), 'wrong password shows a clear message')
        await page.fill('input[name=password]', 'demo1234')
        await page.click('button[type=submit]')
        await page.wait_for_url(re.compile(r'/problems/two-sum'))
        await page.wait_for_selector('.avatar')
        r.check(True, 'demo student signs in and returns to the problem')
        await no_sideways('login return')

        # ---------- JavaScript to Accepted ----------
        await choose_lang('javascript')
        r.check('seen.has' in await page.inner_text('.cm-content'), 'JavaScript draft was kept through sign-in')
        await act('submit')
        v = await verdict()
        r.check(v == 'Accepted', f'JavaScript Two Sum is Accepted ({v})')
        r.check('Re-run on the server' in await page.inner_text('#console-body'), 'JavaScript verdict re-run on the server')
        r.check(await page.locator('.tests-grid i.passed').count() == 6, 'all 6 hidden tests shown passed')
        await shot('js-accepted')

        # ---------- Python to Accepted ----------
        await choose_lang('python')
        await page.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)
        await set_code(PY_TWO_SUM)
        await act('run')
        r.check(await verdict() == 'Sample cases passed', 'Python Run passes the sample cases')
        await act('submit')
        v = await verdict()
        r.check(v == 'Accepted', f'Python Two Sum is Accepted ({v})')
        r.check('never reach the browser' in await page.inner_text('#console-body'), 'Python outputs checked on the server')
        await shot('py-accepted')
        if phone:
            await page.click('.ws-tabs [data-view=problem]')
        r.check(await page.locator('.statement .solved-badge').count() == 1, 'statement shows Solved after Accepted')
        await no_sideways('workspace')

        # ---------- wrong answer ----------
        await page.goto(base + '/problems/max-subarray')
        await page.wait_for_selector('.statement h1')
        await choose_lang('javascript')
        await set_code(JS_WRONG)
        await act('run')
        r.check(await verdict() == 'Wrong Answer', 'Run shows Wrong Answer on a sample')
        r.check(await page.locator('#console-body pre.diff-bad').count() == 1, 'wrong output is highlighted next to expected')
        await act('submit')
        r.check(await verdict() == 'Wrong Answer', 'Submit gives Wrong Answer')
        r.check('failed on hidden test' in (await page.inner_text('#console-body')).lower(), 'first failing hidden test is shown')
        await shot('wrong-answer')

        # ---------- runtime error ----------
        await page.goto(base + '/problems/valid-parentheses')
        await page.wait_for_selector('.statement h1')
        await choose_lang('javascript')
        await set_code(JS_THROWS)
        await act('submit')
        r.check(await verdict() == 'Runtime Error', 'an exception gives Runtime Error')
        r.check('TypeError' in await page.inner_text('#console-body'), 'the error message is shown')

        # ---------- endless loops are killed ----------
        await page.goto(base + '/problems/binary-search')
        await page.wait_for_selector('.statement h1')
        await choose_lang('javascript')
        await set_code(JS_LOOP)
        t0 = time.time()
        await act('run')
        v = await verdict()
        r.check(v == 'Time Limit Exceeded', f'JavaScript endless loop on Run: Time Limit Exceeded ({v})')
        r.check(time.time() - t0 < 12, f'the loop was stopped in {time.time() - t0:.1f}s')
        await choose_lang('python')
        await page.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)
        await set_code(PY_LOOP)
        await act('submit')
        v = await verdict(90000)
        r.check(v == 'Time Limit Exceeded', f'Python endless loop on Submit: Time Limit Exceeded ({v})')
        await shot('tle')
        await set_code(PY_SEARCH)
        await act('submit')
        v = await verdict(90000)
        r.check(v == 'Accepted', f'Python restarts after a killed run and the fixed code is Accepted ({v})')

        # ---------- submissions + profile ----------
        await page.goto(base + '/submissions')
        await page.wait_for_selector('#sub-rows tr')
        rows = await page.locator('#sub-rows tr').all_inner_texts()
        r.check(sum('Time Limit Exceeded' in x and 'sample' not in x.lower() for x in rows) == 1 and sum('Wrong Answer' in x and 'sample' not in x.lower() for x in rows) >= 1, 'submissions list has the new TLE and Wrong Answer')
        await page.select_option('#verdict-filter', 'Accepted')
        r.check(all('Accepted' in x for x in await page.locator('#sub-rows tr').all_inner_texts()), 'verdict filter works')
        await page.locator('#sub-rows tr.click').first.click()
        await page.wait_for_selector('.modal .cm-content')
        r.check('def search' in await page.inner_text('.modal .cm-content'), 'opening a submission shows its code')
        await page.click('.modal [data-close]')
        await no_sideways('submissions')
        await page.goto(base + '/profile')
        await page.wait_for_selector('.ring .label b')
        solved = int(await page.inner_text('.ring .label b'))
        r.check(solved == 7, f'profile counts 7 solved (6 from sample history + Two Sum): {solved}')
        r.check(await page.locator('.heat i[data-l]:not([data-l="0"])').count() > 10, 'activity heatmap is filled')
        await no_sideways('profile')
        await shot('profile')

        # ---------- sprint ----------
        await page.goto(base + '/contest')
        await page.wait_for_selector('#contest-clock')
        c1 = await page.inner_text('#contest-clock')
        await page.wait_for_timeout(1300)
        r.check(c1 != await page.inner_text('#contest-clock'), 'sprint countdown ticks')
        r.check(await page.locator('.board tbody tr').count() >= 14, 'leaderboard lists the sample players')
        await page.click('a[href="/problems/placement-shortlist?contest=1"]')
        await page.wait_for_selector('#ws-clock')
        await choose_lang('javascript')
        await set_code(JS_SHORTLIST)
        await act('submit')
        r.check(await verdict() == 'Accepted', 'sprint problem solved: Accepted')
        await page.click('#console-body a[href="/contest"]')
        await page.wait_for_selector('.board tr.you')
        you = await page.inner_text('.board tr.you')
        r.check('100' in you and 'Aditi Patil' in you, 'leaderboard shows you with 100 points')
        r.check(await page.locator('.cprob.done').count() == 1, 'the solved sprint problem is ticked')
        await no_sideways('contest')
        await shot('contest')

        # ---------- theme ----------
        r.check(await page.evaluate("document.documentElement.dataset.theme") == 'dark', 'dark theme is the default')
        await page.click('#theme-btn')
        r.check(await page.evaluate("document.documentElement.dataset.theme") == 'light', 'light theme switches on')
        await page.goto(base + '/problems/edit-distance')
        await page.wait_for_selector('.statement h1')
        await open_code()
        await page.wait_for_selector('.cm-editor')
        bg = await page.evaluate("getComputedStyle(document.querySelector('.cm-editor')).backgroundColor")
        r.check(bg == 'rgb(255, 255, 255)', f'editor follows the light theme ({bg})')
        await shot('light')
        await page.click('#theme-btn')
        bg = await page.evaluate("getComputedStyle(document.querySelector('.cm-editor')).backgroundColor")
        r.check(bg == 'rgb(16, 17, 20)', f'editor follows the dark theme back ({bg})')

        # ---------- admin ----------
        if phone:
            await page.goto(base + '/profile')
        await page.click('#user-btn')
        await page.click('#logout-btn')
        await page.wait_for_selector('a[href^="/login"]')
        await page.goto(base + '/admin')
        await page.wait_for_selector('.page .card')
        r.check(await page.locator('text=Sign in to see the admin panel').count() == 1, 'admin panel asks for sign-in')
        await page.goto(base + '/login?next=/admin')
        await page.click('[data-demo="admin@codearena.in"]')
        await page.wait_for_selector('.kpis')
        r.check(await page.locator('#admin-body tbody tr').count() == 15, 'admin sees all 15 problems')
        await page.click('[data-tab=submissions]')
        subs = await page.inner_text('#admin-body')
        r.check('Aditi Patil' in subs and 'Time Limit Exceeded' in subs, "admin sees the student's recent submissions")
        await no_sideways('admin')
        await shot('admin')
        await page.click('a[href="/admin/problems/new"]')
        await page.wait_for_selector('#pform')
        await page.fill('input[name=title]', 'Sum of Digits')
        await page.fill('input[name=tags]', 'Math, Loops')
        await page.fill('textarea[name=statement]', 'Given a non-negative integer `n`, return the sum of its digits.')
        await page.fill('textarea[name=constraints]', '0 ≤ n ≤ 10⁹')
        await page.fill('input[name=params]', 'n')
        await page.fill('input[name=fnPython]', 'digit_sum')
        await page.fill('input[name=fnJavascript]', 'digitSum')
        await page.click('button[type=submit]')
        await page.wait_for_selector('#perr:not([hidden])')
        err = await page.inner_text('#perr')
        r.check('JSON' in err or 'one value per parameter' in err, f'incomplete tests get a clear error ({err})')
        await page.fill('[data-k=samples][data-i="0"][data-f=args]', '[123]')
        await page.fill('[data-k=hidden][data-i="0"][data-f=args]', '[0]')
        await page.click('[data-add=hidden]')
        await page.fill('[data-k=hidden][data-i="1"][data-f=args]', '[987654321]')
        await page.fill('#ref-code', JS_DIGITS)
        await page.click('#fill')
        await expect(page.locator('[data-k=hidden][data-i="1"][data-f=expected]')).to_have_value('45')
        r.check(await page.input_value('[data-k=samples][data-i="0"][data-f=expected]') == '6', 'reference solution fills expected outputs')
        await no_sideways('admin editor')
        await shot('admin-new')
        await page.click('button[type=submit]')
        await page.wait_for_url(re.compile(r'/problems/sum-of-digits'))
        await page.wait_for_selector('.statement h1')
        r.check('16. Sum of Digits' in await page.inner_text('.statement h1'), 'new problem is live as #16')
        await choose_lang('javascript')
        r.check('function digitSum(n)' in await page.inner_text('.cm-content'), 'starter code generated from the signature')
        await set_code(JS_DIGITS)
        await act('submit')
        r.check(await verdict() == 'Accepted', 'the new problem judges correctly')
        await page.goto(base + '/admin/problems/sum-of-digits')
        await page.wait_for_selector('#pform')
        await page.fill('input[name=title]', 'Sum of Digits (Revised)')
        await page.click('button[type=submit]')
        await page.wait_for_url(re.compile(r'/problems/sum-of-digits'))
        await page.wait_for_selector('.statement h1')
        r.check('Revised' in await page.inner_text('.statement h1'), 'editing a problem saves')
        await page.goto(base + '/problems')
        await page.wait_for_selector('a.prow')
        r.check(await page.locator('.prow').count() == 16, 'problem list now has 16')

        await page.goto(base + '/no-such-page')
        await page.wait_for_selector('text=Page not found')
        r.check(await page.locator('text=Page not found').count() == 1, 'unknown pages show a 404 view')
    except Exception as e:  # keep going to the report
        r.check(False, f'flow crashed: {e!r}'.splitlines()[0][:300])
        await shot('crash')
    finally:
        r.check(not r.errors, 'zero console errors' + ('' if not r.errors else ': ' + ' | '.join(r.errors[:5])))
        await browser.close()
        if server:
            os.killpg(server.pid, 15)
        shutil.rmtree(data_dir, ignore_errors=True)
    return r


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    names = sys.argv[1:] or list(VIEWPORTS)
    async with async_playwright() as pw:
        results = []
        for n in names:
            print(f'\n== {n} {VIEWPORTS[n]["width"]}x{VIEWPORTS[n]["height"]} ==')
            results.append(await flow(pw, n, VIEWPORTS[n]))
    total = sum(x.passed for x in results)
    failed = [f'{x.name}: {f}' for x in results for f in x.failed]
    print(f'\n{total} passed, {len(failed)} failed')
    for f in failed:
        print('  ' + f)
    sys.exit(1 if failed else 0)


asyncio.run(main())
