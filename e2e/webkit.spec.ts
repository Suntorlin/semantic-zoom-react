// Phone size on the WebKit engine (Playwright's build, not a real iPhone).
// WebKit has no CDP touch input, so a real two-finger pinch can't be driven
// here; Safari's gesture events are dispatched synthetically instead.
import { expect, test } from '@playwright/test'
import { edgeOf, maxAbs, open, settle, startRecording, state, stopRecording } from './helpers'

test('level buttons morph the list and keep the leading item still', async ({ page }) => {
  await open(page, 'travel')
  // Scroll so the first visible item is partly above the top: it is the anchor.
  await page.locator('[data-sz-list]').evaluate((el) => (el.scrollTop = 150))
  await page.waitForTimeout(200)
  const leading = await page.evaluate(() => {
    const list = document.querySelector('[data-sz-list]')!.getBoundingClientRect()
    const el = [...document.querySelectorAll<HTMLElement>('[data-sz-item]')].find((e) => e.getBoundingClientRect().bottom > list.top)!
    const r = el.getBoundingClientRect()
    return { x: r.left + 20, y: Math.max(r.top, list.top) + 5 }
  })
  const probe = await startRecording(page, 'travel', leading.x, leading.y)
  await page.getByRole('radio', { name: 'Full' }).tap()
  await settle(page, 'travel')
  const rec = await stopRecording(page)
  expect((await state(page, 'travel')).level).toBe(2)
  expect(rec.some((r) => r.morphing > 0)).toBe(true)
  const after = await edgeOf(page, 'travel', probe.index)
  console.log(`webkit buttons: ${rec.length} frames, max drift ${maxAbs(rec.map((r) => r.edge - probe.edge)).toFixed(2)}px, final ${(after - probe.edge).toFixed(2)}px`)
  expect(Math.abs(after - probe.edge)).toBeLessThanOrEqual(2)
  await page.screenshot({ path: 'artifacts/e2e/webkit-travel-full.png' })
})

test('Safari gesture events drive the zoom and are prevented', async ({ page }) => {
  await open(page, 'chat')
  const box = (await page.getByTestId('reply-a18').boundingBox())!
  const x = box.x + 40
  const y = box.y + box.height / 2
  const probe = await startRecording(page, 'chat', x, y)
  const prevented = await page.evaluate(
    async ([x, y]) => {
      const el = document.querySelector('[data-sz-list]')!
      const fire = (type: string, scale: number) => {
        const e = new Event(type, { bubbles: true, cancelable: true })
        Object.assign(e, { scale, clientX: x, clientY: y })
        el.dispatchEvent(e)
        return e.defaultPrevented
      }
      const out = [fire('gesturestart', 1)]
      for (let i = 1; i <= 20; i++) {
        out.push(fire('gesturechange', 1 + (2.6 - 1) * (i / 20)))
        await new Promise((r) => requestAnimationFrame(r))
      }
      out.push(fire('gestureend', 2.6))
      return out
    },
    [x, y] as const,
  )
  await settle(page, 'chat')
  const rec = await stopRecording(page)
  expect(prevented.every(Boolean)).toBe(true)
  expect((await state(page, 'chat')).level).toBe(2)
  const after = await edgeOf(page, 'chat', probe.index)
  console.log(`webkit gesture: max drift ${maxAbs(rec.map((r) => r.edge - probe.edge)).toFixed(2)}px, final ${(after - probe.edge).toFixed(2)}px`)
  expect(Math.abs(after - probe.edge)).toBeLessThanOrEqual(2)
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1)
})

test('touch-action keeps one-finger scrolling and blocks page pinch-zoom', async ({ page }) => {
  await open(page, 'chat')
  expect(await page.locator('[data-sz-list]').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-x pan-y')
})

test('tap one reply to expand it, per-character Chinese morph', async ({ page }) => {
  await open(page, 'chat')
  const reply = page.getByTestId('reply-a19')
  await reply.tap()
  await settle(page, 'chat')
  await expect(reply.locator('[data-sz-flow]')).toHaveText(
    '明天先做消息搜索，再清理旧的部署脚本。搜索预计一天，部署脚本半天。',
  )
  // Chinese is split per character: the morph layer has one node per character.
  const nodes = await reply.locator('[data-sz-morph] > *').count()
  expect(nodes).toBeGreaterThan(30)
})
