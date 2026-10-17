import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
const p = await ctx.newPage()
p.on('pageerror', e => console.log('pageerror:', e.message))
p.on('console', m => { if (m.type() === 'error' || m.type()==='warning') console.log('console:', m.text()) })
await p.goto('http://localhost:5188/#' + (process.argv[2] || 'travel')); await p.waitForTimeout(1000)
const cdp = await ctx.newCDPSession(p)
const cx = 196, cy = Number(process.argv[3] || 560)
const anchorTop = () => p.evaluate(([x,y]) => { const el = document.elementFromPoint(x,y)?.closest('[data-sz-item]'); return el ? { idx: el.dataset.index, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom } : null }, [cx, cy])
const before = await anchorTop()
console.log('before', before)
const pts = d => [{ x: cx, y: cy - d/2, id: 1 }, { x: cx, y: cy + d/2, id: 2 }]
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(80) })
const frames = []
for (let i = 1; i <= 20; i++) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(80 + 120*i/20) })
  await p.waitForTimeout(16)
  if (i === 10) await p.screenshot({ path: 'artifacts/mid.png' })
  const r = await p.evaluate((idx) => { const el = document.querySelector(`[data-sz-item][data-index="${idx}"]`); return { top: el.getBoundingClientRect().top, z: window.__sz.travel?.value ?? window.__sz.chat?.value, vv: visualViewport.scale } }, before.idx)
  frames.push(r)
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await p.waitForTimeout(900)
const after = await p.evaluate((idx) => { const el = document.querySelector(`[data-sz-item][data-index="${idx}"]`); const c = window.__sz.travel ?? window.__sz.chat; return { top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, level: c.level, z: c.value, vv: visualViewport.scale } }, before.idx)
console.log('frames', frames.map(f => `${f.z.toFixed(2)}:${(f.top-before.top).toFixed(1)}:${f.vv}`).join(' '))
console.log('after', after)
await p.screenshot({ path: 'artifacts/after.png' })
await b.close()
