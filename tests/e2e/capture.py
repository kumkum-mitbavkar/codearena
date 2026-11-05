# Captures the board screens and the phone recording from a local build.
#   python3 tests/e2e/capture.py <out-dir>
import asyncio, base64, os, subprocess, sys, tempfile, time, shutil, socket
from pathlib import Path
from playwright.async_api import async_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
PY = '''def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
'''
PYMS = '''def max_subarray(nums):
    best = cur = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best
'''
PY_LONGEST = '''def longest_unique(s):
    last = {}
    best = start = 0
    for i, ch in enumerate(s):
        if ch in last and last[ch] >= start:
            start = last[ch] + 1
        last[ch] = i
        best = max(best, i - start + 1)
    return best
'''
JS = '''function shortlist(scores, k) {
  const cut = [...scores].sort((a, b) => b - a)[k - 1];
  return scores.filter((s) => s >= cut).length;
}
'''
def port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

async def verdict(page):
    await expect(page.locator('[data-act=run]:visible').first).to_be_enabled(timeout=90000)
    await page.wait_for_selector('#console-body .verdict h2')

async def put(pg, code):
    await pg.click('.cm-content'); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Delete'); await pg.keyboard.insert_text(code)

async def main():
    P = port(); data = tempfile.mkdtemp()
    srv = subprocess.Popen(['node', 'scripts/dev-server.mjs', str(P)], cwd=ROOT, env={**os.environ, 'CODEARENA_DATA_DIR': data}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    time.sleep(1.2)
    B = f'http://127.0.0.1:{P}'
    async with async_playwright() as pw:
        br = await pw.chromium.launch()
        d = await br.new_context(viewport={'width': 1440, 'height': 900})
        pg = await d.new_page()
        await pg.goto(B + '/login'); await pg.click('[data-demo="student@codearena.in"]'); await pg.wait_for_url(B + '/')
        await pg.goto(B + '/problems/placement-shortlist?contest=1'); await pg.wait_for_selector('.cm-content')
        await pg.select_option('#lang', 'javascript'); await put(pg, JS)
        await pg.locator('[data-act=submit]:visible').first.click(); await verdict(pg)
        await pg.goto(B + '/problems/max-subarray'); await pg.wait_for_selector('.cm-content')
        await pg.select_option('#lang', 'python'); await pg.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)
        await put(pg, PYMS)
        await pg.locator('[data-act=submit]:visible').first.click(); await verdict(pg); await pg.wait_for_timeout(1000)
        await pg.screenshot(path=str(OUT / 'd-accepted.png'))
        await pg.goto(B + '/'); await pg.wait_for_selector('.prow'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(OUT / 'd-home.png'))
        await pg.goto(B + '/contest'); await pg.wait_for_selector('.board'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(OUT / 'd-contest.png'))
        await pg.goto(B + '/profile'); await pg.wait_for_selector('.ring'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=str(OUT / 'd-profile.png'))
        state = await d.storage_state()
        await d.close()

        m = await br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, storage_state=state)
        pg = await m.new_page()
        await pg.goto(B + '/'); await pg.wait_for_selector('.prow'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(OUT / 'm-home.png'))
        await pg.goto(B + '/problems/two-sum'); await pg.wait_for_selector('.statement h1'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(OUT / 'm-problem.png'))
        await pg.click('.ws-tabs [data-view=code]'); await pg.select_option('#lang', 'python')
        await pg.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)
        await put(pg, PY)
        await pg.evaluate('document.activeElement.blur()'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(OUT / 'm-code.png'))
        await pg.locator('[data-act=submit]:visible').first.click(); await verdict(pg); await pg.wait_for_timeout(1000)
        await pg.screenshot(path=str(OUT / 'm-accepted.png'))
        await pg.goto(B + '/contest'); await pg.wait_for_selector('.board'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('.board').scrollIntoView({block:'start'}); window.scrollBy(0,-70)")
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(OUT / 'm-contest.png'))
        await pg.goto(B + '/profile'); await pg.wait_for_selector('.ring'); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=str(OUT / 'm-profile.png'))
        await m.close()

        # phone recording via a CDP screencast at 2x
        m = await br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, storage_state=state)
        pg = await m.new_page()
        await pg.goto(B + '/problems/rotate-matrix'); await pg.wait_for_selector('.statement h1')
        await pg.evaluate("localStorage.setItem('ca-lang','python'); localStorage.removeItem('ca-code:longest-unique-substring:python')")
        await pg.click('.ws-tabs [data-view=code]'); await pg.select_option('#lang', 'python')
        await pg.wait_for_selector('#py-status:has-text("Python ready")', timeout=90000)
        await pg.click('.ws-bar a.crumbs'); await pg.wait_for_selector('.prow'); await pg.wait_for_timeout(400)
        cdp = await m.new_cdp_session(pg)
        frames = []
        def on_frame(ev):
            frames.append((ev['metadata']['timestamp'], ev['data']))
            asyncio.ensure_future(cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']}))
        cdp.on('Page.screencastFrame', on_frame)
        await cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 88, 'maxWidth': 780, 'maxHeight': 1688, 'everyNthFrame': 1})
        await pg.wait_for_timeout(1500)
        await pg.click('a.prow[href="/problems/longest-unique-substring"]'); await pg.wait_for_selector('.statement h1')
        await pg.wait_for_timeout(1000)
        for _ in range(4):
            await pg.mouse.wheel(0, 80); await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(900)
        await pg.click('.ws-tabs [data-view=code]'); await pg.wait_for_timeout(500)
        await pg.click('.cm-content'); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Delete')
        for line in PY_LONGEST.splitlines(True):
            for chunk in [line[i:i + 7] for i in range(0, len(line), 7)]:
                await pg.keyboard.insert_text(chunk); await pg.wait_for_timeout(45)
        await pg.evaluate('document.activeElement.blur()')
        await pg.wait_for_timeout(500)
        await pg.locator('[data-act=run]:visible').first.click(); await verdict(pg); await pg.wait_for_timeout(1900)
        await pg.locator('[data-act=submit]:visible').first.click(); await verdict(pg); await pg.wait_for_timeout(2800)
        await pg.click('.ws-bar a.crumbs'); await pg.wait_for_selector('.prow'); await pg.wait_for_timeout(500)
        await pg.click('.tabbar a[href="/contest"]'); await pg.wait_for_selector('.board'); await pg.wait_for_timeout(1000)
        for _ in range(8):
            await pg.mouse.wheel(0, 90); await pg.wait_for_timeout(110)
        await pg.wait_for_timeout(2000)
        await cdp.send('Page.stopScreencast')
        await m.close(); await br.close()
    os.killpg(srv.pid, 15); shutil.rmtree(data, ignore_errors=True)
    fd = OUT / 'frames'; shutil.rmtree(fd, ignore_errors=True); fd.mkdir()
    lines = []
    for i, (ts, b64) in enumerate(frames):
        f = fd / f'{i:05d}.jpg'; f.write_bytes(base64.b64decode(b64))
        dur = (frames[i + 1][0] - ts) if i + 1 < len(frames) else 0.5
        lines.append(f"file '{f}'\nduration {max(dur, 0.001):.4f}\n")
    lines.append(f"file '{fd / f'{len(frames) - 1:05d}.jpg'}'\n")
    (OUT / 'concat.txt').write_text(''.join(lines))
    print('frames', len(frames), 'span', frames[-1][0] - frames[0][0])
asyncio.run(main())
