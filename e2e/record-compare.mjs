// Records the original Flutter demo and this port doing the same gestures,
// for a side-by-side comparison. Usage: node e2e/record-compare.mjs <portUrl>
import { chromium } from 'playwright'
import fs from 'node:fs'

const PORT_URL = process.argv[2] ?? 'http://localhost:5189/#travel'
const ORIGINAL_URL = 'https://roshendz.github.io/semantic_zoom/'
const out = 'artifacts/compare'

async function record(name, url, ready, tapLevel) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    recordVideo: { dir: `${out}/${name}`, size: { width: 393, height: 852 } },
  })
  const created = Date.now()
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await ready(page)
  const cdp = await ctx.newCDPSession(page)
  const pinch = async (y, from, to) => {
    const pts = (d) => [{ x: 196, y: y - d / 2, id: 1 }, { x: 196, y: y + d / 2, id: 2 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) })
    for (let i = 1; i <= 24; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + ((to - from) * i) / 24) })
      await page.waitForTimeout(25)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const tap = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 3 }] })
    await page.waitForTimeout(60)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const start = Date.now()
  await page.waitForTimeout(1000)
  await pinch(545, 80, 165) // to Summary
  await page.waitForTimeout(1300)
  await page.screenshot({ path: `${out}/${name}-summary.png` })
  await pinch(545, 80, 175) // to Full
  await page.waitForTimeout(1300)
  await page.screenshot({ path: `${out}/${name}-full.png` })
  await tapLevel(page, tap) // back to Highlights with the buttons
  await page.waitForTimeout(1500)
  await tap(150, 545) // tap one entry
  await page.waitForTimeout(1300)
  await page.screenshot({ path: `${out}/${name}-tap1.png` })
  await tap(150, 545)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/${name}-tap2.png` })
  const end = Date.now()
  const video = page.video()
  await ctx.close()
  await browser.close()
  const file = await video.path()
  fs.renameSync(file, `${out}/${name}.webm`)
  return { offset: (start - created) / 1000, duration: (end - start) / 1000 }
}

const original = await record(
  'original',
  ORIGINAL_URL,
  (p) => p.waitForTimeout(3500),
  (p, tap) => tap(73, 744),
)
const port = await record(
  'port',
  PORT_URL,
  (p) => p.waitForFunction(() => !!window.__sz?.travel).then(() => p.waitForTimeout(800)),
  async (p, tap) => {
    const b = await p.getByRole('radio', { name: 'Highlights' }).boundingBox()
    await tap(b.x + b.width / 2, b.y + b.height / 2)
  },
)
fs.writeFileSync(`${out}/timing.json`, JSON.stringify({ original, port }, null, 2))
console.log(JSON.stringify({ original, port }))
