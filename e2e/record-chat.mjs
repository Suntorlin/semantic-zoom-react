// Records the AI chat demo for the report: pinch to summary, to full steps,
// back with the buttons, then tap one reply.
import { chromium } from 'playwright'
import fs from 'node:fs'
const out = 'artifacts/report'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, recordVideo: { dir: `${out}/chatvid`, size: { width: 393, height: 852 } } })
const created = Date.now()
const p = await ctx.newPage()
await p.goto('http://localhost:5189/#chat'); await p.waitForFunction(() => !!window.__sz?.chat); await p.waitForTimeout(800)
const start = Date.now()
const cdp = await ctx.newCDPSession(p)
const pinch = async (y, from, to, shot) => {
  const pts = d => [{ x: 196, y: y - d/2, id: 1 }, { x: 196, y: y + d/2, id: 2 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) })
  for (let i = 1; i <= 24; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + (to - from) * i / 24) })
    await p.waitForTimeout(30)
    if (shot && i === 12) await p.screenshot({ path: `${out}/${shot}` })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}
await p.waitForTimeout(800)
await p.screenshot({ path: `${out}/chat-0.png` })
await pinch(420, 80, 125, 'chat-mid.png')
await p.waitForTimeout(1200)
await p.screenshot({ path: `${out}/chat-1.png` })
await pinch(420, 80, 125)
await p.waitForTimeout(1200)
await p.screenshot({ path: `${out}/chat-2.png` })
await p.getByRole('radio', { name: '只看结论' }).tap()
await p.waitForTimeout(1300)
await p.getByTestId('reply-a18').tap()
await p.waitForTimeout(1300)
await p.getByTestId('reply-a18').tap()
await p.waitForTimeout(1500)
await p.screenshot({ path: `${out}/chat-tap.png` })
const end = Date.now()
const v = p.video()
await ctx.close(); await b.close()
fs.renameSync(await v.path(), `${out}/chat.webm`)
fs.writeFileSync(`${out}/chat-timing.json`, JSON.stringify({ offset: (start - created) / 1000, duration: (end - start) / 1000 }))
