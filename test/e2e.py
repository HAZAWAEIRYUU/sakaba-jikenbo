import asyncio, sys, random
from playwright.async_api import async_playwright
BASE='http://localhost:8765/index.html'
GAMES={'mogu':6,'bottle':5,'kessha':12,'souzoku':7}
async def main():
    async with async_playwright() as pw:
        br=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        errors=[]
        for game,n in GAMES.items():
            ctx=await br.new_context(viewport={'width':390,'height':844})
            pages=[]
            host=await ctx.new_page(); pages.append(host)
            host.on('pageerror',lambda e:errors.append(str(e)))
            host.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'fonts' not in m.text and 'ERR_' not in m.text else None)
            await host.goto(BASE); await host.click('[data-act=create]')
            await host.wait_for_selector('#name-in'); await host.fill('#name-in','幹事'); await host.click('[data-act=join]')
            await host.wait_for_selector('.code'); code=(await host.inner_text('.code')).strip()
            for i in range(1,n):
                p=await ctx.new_page(); pages.append(p)
                p.on('pageerror',lambda e:errors.append(str(e)))
                await p.goto(BASE+'#r-'+code); await p.wait_for_selector('#name-in'); await p.fill('#name-in',f'客{i}'); await p.click('[data-act=join]')
                await p.wait_for_selector('text=幹事が始めるのを待っています')
            await host.wait_for_selector(f'text=参加者（{n}人）')
            await host.click(f'[data-act=game][data-id={game}]')
            await host.wait_for_selector(f'[data-id={game}][aria-pressed=true]')
            if game=='mogu': await host.screenshot(path='test/lobby.png',full_page=True)
            await host.click('[data-act=start]')
            roles=[]
            for p in pages:
                await p.wait_for_selector('.paper .role'); roles.append(await p.inner_text('.paper .role'))
            print(game,code,roles)
            if game=='bottle': await pages[1].screenshot(path='test/play.png',full_page=True)
            await host.click('[data-act=tovote]')
            for p in pages:
                await p.wait_for_selector('.count')
                if game=='kessha':
                    if await p.locator('[data-act=kg]').count():
                        await p.locator('[data-act=kg]').nth(random.randrange(6)).click()
                        await p.wait_for_selector('[data-act=kg][aria-pressed=true]')
                        ks=p.locator('[data-act=ks]'); await ks.nth(random.randrange(await ks.count())).click()
                        await p.wait_for_selector('[data-act=ks][aria-pressed=true]')
                else:
                    vs=p.locator('[data-act=vote]'); await vs.nth(0 if game!='mogu' else random.randrange(await vs.count())).click()
                    await p.wait_for_selector('[data-act=vote][aria-pressed=true]')
            exp=n-1 if game=='kessha' else n
            await host.wait_for_selector(f'text=投票済み {exp} / {exp}人')
            if game=='kessha': await pages[2].screenshot(path='test/vote.png',full_page=True)
            await host.click('[data-act=tally]')
            for _ in range(60):
                await asyncio.sleep(0.25)
                for p in pages:
                    if await p.locator('[data-act=guess]').count():
                        await p.locator('[data-act=guess]').nth(0).click()
                if all([await p.locator('.verdict').count() for p in pages]): break
            else:
                print('STUCK', [ (await p.inner_text('#view'))[:80].replace('\n',' / ') for p in pages]); errors.append('stuck')
            print('  ->',await host.inner_text('.verdict'))
            if game=='souzoku': await pages[3].screenshot(path='test/end.png',full_page=True)
            # もう一度
            await host.click('[data-act=start]')
            for p in pages: await p.wait_for_selector('.paper .role')
            await host.click('[data-act=tovote]'); await host.wait_for_selector('[data-act=tally]'); await host.click('[data-act=tally]')
            await host.wait_for_selector('.verdict')
            await host.click('[data-act=tolobby]'); await pages[1].wait_for_selector('text=幹事が始めるのを待っています')
            for p in pages:
                t=await p.inner_text('#view')
                if 'undefined' in t or 'NaN' in t: errors.append('bad text')
            await ctx.close()
        await br.close()
        print('errors:',errors)
        sys.exit(1 if errors else 0)
asyncio.run(main())
