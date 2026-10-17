import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
p.on('pageerror', e => console.log('pageerror:', e.message))
await p.goto('http://localhost:5188/#travel'); await p.waitForTimeout(1000)
await p.evaluate(() => {
  const c = window.__sz.travel
  window.__log = []
  const orig = c._frame.bind(c)
  c._frame = () => {
    orig()
    const el = document.querySelector('[data-sz-item][data-index="4"]')
    const sc = document.querySelector('[data-sz-list]')
    const a = [...c._clients][0]
    window.__log.push([c.value.toFixed(2), el.getBoundingClientRect().top.toFixed(1), sc.scrollTop.toFixed(1), sc.scrollHeight, a.lastCorrection.toFixed(1), a.anchor?.dataset?.index, a.spacerHeight.toFixed(1)].join(' '))
  }
})
const cdp = await ctx.newCDPSession(p)
const cx = 196, cy = 560
const pts = d => [{ x: cx, y: cy - d/2, id: 1 }, { x: cx, y: cy + d/2, id: 2 }]
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(80) })
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(80 + 120*i/20) }); await p.waitForTimeout(16) }
console.log((await p.evaluate(() => window.__log)).join('\n'))
await b.close()
