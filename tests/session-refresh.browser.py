import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width":1280,"height":1800})
        requests=[]
        page.on('request', lambda r: requests.append(r.url) if '_serverFn' in r.url or '/sessions?' in r.url else None)
        await page.goto('http://localhost:8080/sessions', wait_until='networkidle')
        assert len(requests)==0, requests
        await page.get_by_role('button',name='7 days',exact=True).click()
        await page.get_by_role('button',name='Last 24h',exact=True).click()
        await page.get_by_role('button',name='Custom',exact=True).click()
        await page.get_by_label('Custom start').fill('2026-10-05')
        await page.get_by_label('Custom end').fill('2026-10-27')
        await page.get_by_role('button',name='Apply',exact=True).click()
        await page.wait_for_timeout(700)
        assert len(requests)==0, requests
        print('No API requests on opening, preset changes or Apply')
        await page.get_by_role('button',name='Refresh',exact=True).click()
        await page.wait_for_function("document.body.innerText.includes('Last synced') || document.body.innerText.includes('Sync failed')",timeout=60000)
        assert len(requests)==1, requests
        print('Refresh made exactly one request; returned session data:',await page.get_by_text('Last synced',exact=False).count())
        await page.get_by_role('button',name='30 days',exact=True).click()
        await page.wait_for_timeout(500)
        assert len(requests)==1
        await page.screenshot(path='/tmp/browser/session-refresh/result.png')
        print('Changing dates after loading made no additional request')
        await browser.close()

asyncio.run(main())
