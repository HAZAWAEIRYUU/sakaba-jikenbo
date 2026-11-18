import asyncio
from playwright.async_api import async_playwright
B='http://localhost:8765/index.html'
async def main():
    async with async_playwright() as pw:
        br=await pw.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        ctx=await br.new_context(viewport={'width':390,'height':844}); h=await ctx.new_page(); pages=[h]; errs=[]
        await h.goto(B); await h.click('[data-act=create]')
        await h.wait_for_selector('#name-in'); await h.fill('#name-in','幹事'); await h.click('[data-act=join]')
        await h.wait_for_selector('.code'); code=(await h.inner_text('.code')).strip()
        for i in range(1,5):
            p=await ctx.new_page(); pages.append(p); p.on('pageerror',lambda e:errs.append(str(e)))
            await p.goto(B+'#r-'+code); await p.fill('#name-in',f'客{i}'); await p.click('[data-act=join]'); await p.wait_for_selector('text=幹事が始める')
        await h.wait_for_selector('.chips .chip >> nth=4')
        await h.click('[data-act=start]')
        names=['幹事','客1','客2','客3','客4']; agent=None
        for i,p in enumerate(pages):
            await p.wait_for_selector('.paper .role')
            if '取締官' in await p.inner_text('.paper .role'): agent=i
        await h.click('[data-act=tovote]')
        for i,p in enumerate(pages):
            await p.wait_for_selector('.count')
            target=names[agent] if i!=agent else names[(agent+1)%5]
            await p.click(f'[data-act=vote]:text-is("{target}")'); await p.wait_for_selector('[data-act=vote][aria-pressed=true]')
        await h.wait_for_selector('text=投票済み 5 / 5人'); await h.click('[data-act=tally]')
        ag=pages[agent]; await ag.wait_for_selector('[data-act=guess]')
        other=pages[(agent+1)%5]; await other.wait_for_selector('text=取締官は'); print('other sees:',(await other.inner_text('h2')))
        await ag.screenshot(path='test/guess.png',full_page=True)
        await ag.locator('[data-act=guess]').nth(2).click()
        for p in pages: await p.wait_for_selector('.verdict')
        print('verdict:',await h.inner_text('.verdict')); print('errs',errs)
        await br.close()
asyncio.run(main())
