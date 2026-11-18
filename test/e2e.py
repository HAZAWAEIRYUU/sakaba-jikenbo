# 4つのゲームを、タブを別々のスマホに見立てて最後まで通す（お試しモード ?local=1）
import asyncio, sys, random
from playwright.async_api import async_playwright
BASE='http://localhost:8765/index.html?local=1'
GAMES={'mogu':(7,{'agents':'2','laps':'1'}),'bottle':(5,{'level':'normal'}),'kessha':(12,{'spy':'on','cands':'4'}),'souzoku':(6,{})}
async def main():
    async with async_playwright() as pw:
        br=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        errors=[]
        def watch(p):
            p.on('pageerror',lambda e:errors.append(str(e)))
            p.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'fonts' not in m.text else None)
        for game,(n,sets) in GAMES.items():
            ctx=await br.new_context(viewport={'width':390,'height':844})
            host=await ctx.new_page(); watch(host); pages=[host]
            await host.goto(BASE)
            if game=='mogu': await host.screenshot(path='test/s1_home.png',full_page=True)
            await host.click('[data-act=create]')
            await host.wait_for_selector('#name-in'); await host.fill('#name-in','幹事'); await host.click('[data-act=join]')
            await host.wait_for_selector('.code'); code=(await host.inner_text('.code')).strip()
            for i in range(1,n):
                p=await ctx.new_page(); watch(p); pages.append(p)
                await p.goto(BASE+'#r-'+code); await p.wait_for_selector('#name-in'); await p.fill('#name-in',f'客{i}'); await p.click('[data-act=join]')
                await p.wait_for_selector('text=幹事が始めるのを待っています')
            await host.wait_for_selector(f'text=参加者 {n}人')
            await host.click(f'[data-act=game][data-id={game}]'); await host.wait_for_selector('.rules')
            for k,v in sets.items():
                await host.click(f'[data-act=set][data-k={k}][data-v="{v}"]'); await host.wait_for_selector(f'[data-k={k}][data-v="{v}"][aria-pressed=true]')
            await pages[1].wait_for_selector('.rules')
            if game=='mogu':
                await host.screenshot(path='test/s2_lobby.png',full_page=True); await pages[1].screenshot(path='test/s3_guest_lobby.png',full_page=True)
            await host.click('[data-act=start]')
            for p in pages: await p.wait_for_selector('.paper .role')
            roles=[await p.inner_text('.paper .role') for p in pages]
            print(game,code,roles)
            # 順番に話す：本人がボタンを押す
            steps=0
            while game!='kessha':
                await asyncio.sleep(0.15)
                if await host.locator('.turn').count()==0: break
                pressed=False
                for p in pages[1:]+[host]:
                    if await p.locator('.turn.mine [data-act=nextturn]').count():
                        if game=='bottle' and steps==1: await p.screenshot(path='test/s4_turn.png',full_page=True)
                        await p.click('.turn.mine [data-act=nextturn]'); pressed=True; steps+=1; break
                if not pressed: errors.append('no speaker'); break
            if game!='kessha': print('  turns',steps)
            await host.wait_for_selector('[data-act=tovote]')
            if game=='bottle': await pages[2].screenshot(path='test/s5_talk.png',full_page=True)
            await host.click('[data-act=tovote]')
            for p in pages:
                await p.wait_for_selector('.count')
                if game=='kessha':
                    if await p.locator('[data-act=kg]').count():
                        await p.locator('[data-act=kg]').nth(random.randrange(4)).click(); await p.wait_for_selector('[data-act=kg][aria-pressed=true]')
                        ks=p.locator('[data-act=ks]'); await ks.nth(random.randrange(await ks.count())).click(); await p.wait_for_selector('[data-act=ks][aria-pressed=true]')
                else:
                    vs=p.locator('[data-act=vote]'); await vs.nth(random.randrange(await vs.count()) if game=='mogu' else 0).click(); await p.wait_for_selector('[data-act=vote][aria-pressed=true]')
            if game=='kessha': await pages[3].screenshot(path='test/s6_kessha_vote.png',full_page=True)
            exp=n-1 if game=='kessha' else n
            await host.wait_for_selector(f'text=投票済み {exp} / {exp}人'); await host.click('[data-act=tally]')
            for _ in range(60):
                await asyncio.sleep(0.25)
                for p in pages:
                    if await p.locator('[data-act=guess]').count(): await p.locator('[data-act=guess]').nth(0).click()
                if all([await p.locator('.verdict').count() for p in pages]): break
            else: errors.append('stuck '+game)
            print('  ->',await host.inner_text('.verdict'))
            # もう1回やって、点数が積み上がるか
            await host.click('[data-act=start]')
            for p in pages: await p.wait_for_selector('.paper .role')
            while await host.locator('[data-act=tovote]').count()==0:
                await host.click('[data-act=nextturn]'); await asyncio.sleep(0.1)
            await host.click('[data-act=tovote]'); await host.wait_for_selector('[data-act=tally]'); await host.click('[data-act=tally]')
            for _ in range(40):
                await asyncio.sleep(0.25)
                for p in pages:
                    if await p.locator('[data-act=guess]').count(): await p.locator('[data-act=guess]').nth(1).click()
                if await host.locator('.verdict').count(): break
            if game=='souzoku': await pages[1].screenshot(path='test/s7_end.png',full_page=True)
            total=sum([int(t) for t in await host.locator('.score b').all_inner_texts()])
            print('  score total',total)
            await host.click('[data-act=tolobby]'); await pages[1].wait_for_selector('text=幹事が始めるのを待っています')
            for p in pages:
                t=await p.inner_text('#view')
                if 'undefined' in t or 'NaN' in t: errors.append('bad text '+game)
            await ctx.close()
        await br.close()
        print('errors:',errors); sys.exit(1 if errors else 0)
asyncio.run(main())
