import { chromium } from 'playwright'
const b = await chromium.launch()
const out = 'artifacts/haqi-ui'
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: theme })
  const p = await ctx.newPage()
  p.on('pageerror', e => console.log('pageerror', e.message))
  for (const tab of ['chat', 'travel', 'grid', 'inbox', 'reads', 'perf']) {
    await p.goto(`http://localhost:5188/?theme=${theme}#${tab}`); await p.waitForTimeout(700)
    await p.screenshot({ path: `${out}/phone-${theme}-${tab}.png` })
  }
  await ctx.close()
  const d = await b.newContext({ viewport: { width: 1200, height: 800 }, colorScheme: theme })
  const dp = await d.newPage()
  await dp.goto(`http://localhost:5188/?theme=${theme}#grid`); await dp.waitForTimeout(700)
  await dp.screenshot({ path: `${out}/desktop-${theme}-grid.png` })
  await d.close()
}
await b.close()
