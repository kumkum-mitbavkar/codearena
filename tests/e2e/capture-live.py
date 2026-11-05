# Board screens and a phone recording of a running CodeArena (local or deployed).
#   python3 tests/e2e/capture-live.py <base-url> <out-dir>
# Signs in as the demo student and submits; use Admin > Reset demo data afterwards on a deployed site.
import asyncio, base64, sys, shutil
from pathlib import Path
from playwright.async_api import async_playwright, expect
B = sys.argv[1].rstrip('/')
OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
PY_TWO = 'def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n'
PY_MS = 'def max_subarray(nums):\n    best = cur = nums[0]\n    for x in nums[1:]:\n        cur = max(x, cur + x)\n        best = max(best, cur)\n    return best\n'
MOB = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)

async def verdict(pg):
    await expect(pg.locator('[data-act=run]:visible').first).to_be_enabled(timeout=90000)
    await pg.wait_for_selector('#console-body .verdict h2', timeout=90000)

async def put(pg, code):
    await pg.click('.cm-content'); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Delete'); await pg.keyboard.insert_text(code)

async def login(pg):
    await pg.goto(B + '/login'); await pg.click('[data-demo="student@codearena.in"]'); await pg.wait_for_selector('.avatar')

async def main():
    errors = []
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        # desktop
        d = await br.new_context(viewport={'width': 1440, 'height': 900})
        pg = await d.new_page(); pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await pg.goto(B + '/'); await pg.wait_for_selector('.mo-ac', timeout=30000); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(OUT / 'd-landing.png'))
        await login(pg)
        await pg.goto(B + '/problems/max-subarray'); await pg.wait_for_selector('.cm-content')
        await pg.select_option('#lang', 'python'); await pg.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)
        await put(pg, PY_MS); await pg.evaluate('document.activeElement.blur()')
        await pg.locator('[data-act=submit]:visible').first.click(); await verdict(pg); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=str(OUT / 'd-accepted.png'))
        await pg.goto(B + '/problems'); await pg.wait_for_selector('a.prow'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(OUT / 'd-problems.png'))
        await pg.goto(B + '/profile'); await pg.wait_for_selector('.ring'); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=str(OUT / 'd-profile.png'))
        await pg.goto(B + '/contest'); await pg.wait_for_selector('.board'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(OUT / 'd-contest.png'))
        state = await d.storage_state(); await d.close()

        # phone stills
        m = await br.new_context(**MOB)
        pg = await m.new_page(); pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await pg.goto(B + '/'); await pg.wait_for_selector('.l-title'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=str(OUT / 'm-landing.png'))
        await pg.evaluate("document.querySelector('.l-demo').scrollIntoView({block:'center'})")
        await pg.wait_for_selector('.mo-ac', timeout=30000); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(OUT / 'm-landing-demo.png'))
        await m.close()
        m = await br.new_context(**MOB, storage_state=state)
        pg = await m.new_page(); pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await pg.goto(B + '/problems'); await pg.wait_for_selector('a.prow'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(OUT / 'm-problems.png'))
        await pg.goto(B + '/problems/two-sum'); await pg.wait_for_selector('.statement h1')
        await pg.click('.ws-tabs [data-view=code]'); await pg.select_option('#lang', 'python')
        await pg.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)
        await put(pg, PY_TWO); await pg.evaluate('document.activeElement.blur()'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(OUT / 'm-code.png'))
        await pg.locator('[data-act=submit]:visible').first.click(); await verdict(pg); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=str(OUT / 'm-accepted.png'))
        await pg.goto(B + '/contest'); await pg.wait_for_selector('.board'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('.board').scrollIntoView({block:'start'}); window.scrollBy(0,-120)")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(OUT / 'm-contest.png'))
        await pg.goto(B + '/profile'); await pg.wait_for_selector('.ring'); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=str(OUT / 'm-profile.png'))
        await m.close()

        # phone recording: landing -> problem list -> Two Sum -> code -> Submit -> Accepted -> leaderboard
        m = await br.new_context(**MOB, storage_state=state)
        pg = await m.new_page(); pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await pg.goto(B + '/problems/valid-anagram'); await pg.wait_for_selector('.statement h1')
        await pg.evaluate("localStorage.setItem('ca-lang','python'); localStorage.removeItem('ca-code:two-sum:python')")
        await pg.click('.ws-tabs [data-view=code]'); await pg.select_option('#lang', 'python')
        await pg.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)  # warm Pyodide before recording
        await pg.goto(B + '/'); await pg.wait_for_selector('.l-title')
        cdp = await m.new_cdp_session(pg)
        frames = []
        def on_frame(ev):
            frames.append((ev['metadata']['timestamp'], ev['data']))
            asyncio.ensure_future(cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']}))
        cdp.on('Page.screencastFrame', on_frame)
        await cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 85, 'maxWidth': 780, 'maxHeight': 1688, 'everyNthFrame': 1})
        await pg.wait_for_timeout(2200)
        for _ in range(6):
            await pg.mouse.wheel(0, 70); await pg.wait_for_timeout(90)
        await pg.wait_for_timeout(2600)
        await pg.evaluate('window.scrollTo({top:0,behavior:"smooth"})'); await pg.wait_for_timeout(700)
        await pg.click('#start-solving'); await pg.wait_for_selector('a.prow'); await pg.wait_for_timeout(1100)
        await pg.click('a.prow[href="/problems/two-sum"]'); await pg.wait_for_selector('.statement h1'); await pg.wait_for_timeout(1300)
        await pg.click('.ws-tabs [data-view=code]'); await pg.wait_for_timeout(400)
        await pg.click('.cm-content'); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Delete')
        for line in PY_TWO.splitlines(True):
            for chunk in [line[i:i + 8] for i in range(0, len(line), 8)]:
                await pg.keyboard.insert_text(chunk); await pg.wait_for_timeout(28)
        await pg.evaluate('document.activeElement.blur()'); await pg.wait_for_timeout(400)
        await pg.locator('[data-act=submit]:visible').first.click(); await verdict(pg); await pg.wait_for_timeout(2600)
        await pg.click('.ws-bar a.crumbs'); await pg.wait_for_selector('a.prow'); await pg.wait_for_timeout(300)
        await pg.click('.tabbar a[href="/contest"]'); await pg.wait_for_selector('.board'); await pg.wait_for_timeout(700)
        for _ in range(7):
            await pg.mouse.wheel(0, 90); await pg.wait_for_timeout(100)
        await pg.wait_for_timeout(1600)
        await cdp.send('Page.stopScreencast')
        await m.close(); await br.close()
    fd = OUT / 'frames'; shutil.rmtree(fd, ignore_errors=True); fd.mkdir()
    lines = []
    for i, (ts, b64) in enumerate(frames):
        f = fd / f'{i:05d}.jpg'; f.write_bytes(base64.b64decode(b64))
        dur = (frames[i + 1][0] - ts) if i + 1 < len(frames) else 0.5
        lines.append(f"file '{f}'\nduration {max(dur, 0.001):.4f}\n")
    lines.append(f"file '{fd / f'{len(frames) - 1:05d}.jpg'}'\n")
    (OUT / 'concat.txt').write_text(''.join(lines))
    print('frames', len(frames), 'span', round(frames[-1][0] - frames[0][0], 1))
    print('console errors', errors)
asyncio.run(main())
