// Desktop size (1280×800), Chromium: ctrl + wheel (trackpad pinch) and keyboard shortcuts.
import { expect, test } from '@playwright/test'
import { ctrlWheel, edgeOf, itemCenter, maxAbs, open, settle, startRecording, state, stopRecording } from './helpers'

test('ctrl + wheel zooms the list, not the page; anchor stays put', async ({ page }) => {
  // A long list, so the anchored item can stay exactly where it was.
  await open(page, 'perf')
  await page.waitForTimeout(1500)
  const cdp = await page.context().newCDPSession(page)
  const { x, y } = await itemCenter(page, 3)
  await page.mouse.move(x, y)
  const dpr = await page.evaluate(() => devicePixelRatio)
  const probe = await startRecording(page, 'perf', x, y)
  // A trackpad pinch-out arrives as small negative deltas with ctrlKey.
  await ctrlWheel(cdp, page, x, y, -12, 30)
  await settle(page, 'perf')
  const rec = await stopRecording(page)
  const after = await edgeOf(page, 'perf', probe.index)
  const s = await state(page, 'perf')
  console.log(`ctrl+wheel: level ${s.level}, max drift ${maxAbs(rec.map((r) => r.edge - probe.edge)).toFixed(2)}px, final ${(after - probe.edge).toFixed(2)}px`)
  expect(s.level).toBe(2)
  expect(maxAbs(rec.map((r) => r.edge - probe.edge))).toBeLessThanOrEqual(2)
  expect(Math.abs(after - probe.edge)).toBeLessThanOrEqual(2)
  // The browser's own zoom did not change.
  expect(await page.evaluate(() => devicePixelRatio)).toBe(dpr)
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1)

  await ctrlWheel(cdp, page, x, y, 12, 30)
  await settle(page, 'perf')
  expect((await state(page, 'perf')).level).toBe(0)
})

test('ctrl + wheel on a short list: holds while zooming, then springs back with no blank space', async ({ page }) => {
  await open(page, 'travel')
  const cdp = await page.context().newCDPSession(page)
  const { x, y } = await itemCenter(page, 3)
  await page.mouse.move(x, y)
  const probe = await startRecording(page, 'travel', x, y)
  await ctrlWheel(cdp, page, x, y, -12, 30)
  await settle(page, 'travel')
  const rec = (await stopRecording(page)).filter((r) => r.active)
  const drift = maxAbs(rec.map((r) => r.edge - probe.edge))
  console.log(`ctrl+wheel short list: max drift while zooming ${drift.toFixed(2)}px`)
  expect((await state(page, 'travel')).level).toBe(2)
  expect(drift).toBeLessThanOrEqual(2)
  await page.waitForTimeout(400)
  expect(await page.locator('[data-sz-list]').evaluate((el) => (el.querySelector('[data-sz-spacer]') as HTMLElement | null)?.offsetHeight ?? 0)).toBe(0)
  await page.screenshot({ path: 'artifacts/e2e/desktop-travel.png' })
})

test('one wheel notch with ctrl moves about one level', async ({ page }) => {
  await open(page, 'travel')
  const cdp = await page.context().newCDPSession(page)
  await ctrlWheel(cdp, page, 400, 400, -100, 1)
  await settle(page, 'travel')
  expect((await state(page, 'travel')).level).toBe(1)
})

test('a wheel without ctrl scrolls instead of zooming', async ({ page }) => {
  await open(page, 'perf')
  await page.mouse.move(400, 400)
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(400)
  expect(await page.locator('[data-sz-list]').evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
  expect((await state(page, 'perf')).value).toBe(0)
})

test('keyboard: Ctrl/⌘ + = / - / 0', async ({ page }) => {
  await open(page, 'travel')
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  for (const m of [mod, 'Control']) {
    await page.keyboard.press(`${m}+Equal`)
    await settle(page, 'travel')
    expect((await state(page, 'travel')).level).toBe(1)
    await page.keyboard.press(`${m}+Equal`)
    await settle(page, 'travel')
    expect((await state(page, 'travel')).level).toBe(2)
    await page.keyboard.press(`${m}+Minus`)
    await settle(page, 'travel')
    expect((await state(page, 'travel')).level).toBe(1)
    await page.keyboard.press(`${m}+Digit0`)
    await settle(page, 'travel')
    expect((await state(page, 'travel')).level).toBe(0)
  }
  // The browser's page zoom was not triggered.
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1)
})

test('keyboard: level buttons are a radio group with arrow keys', async ({ page }) => {
  await open(page, 'chat')
  await page.getByRole('radio', { name: '只看结论' }).focus()
  await page.keyboard.press('ArrowRight')
  await settle(page, 'chat')
  expect((await state(page, 'chat')).level).toBe(1)
  await expect(page.getByRole('radio', { name: '看摘要' })).toBeFocused()
  await page.keyboard.press('End')
  await settle(page, 'chat')
  expect((await state(page, 'chat')).level).toBe(2)
})

test('programmatic setLevel', async ({ page }) => {
  await open(page, 'chat')
  await page.evaluate(() => window.__sz!.chat.setLevel(2))
  await settle(page, 'chat')
  await expect(page.getByTestId('reply-a0').locator('[data-sz-flow]')).toContainText('4. 重新部署后用无痕窗口')
  await page.evaluate(() => window.__sz!.chat.jumpToLevel(0))
  await settle(page, 'chat')
  expect((await state(page, 'chat')).value).toBe(0)
})

test('grid: two columns on a wide screen; ctrl+wheel keeps the card under the pointer', async ({ page }) => {
  await open(page, 'grid')
  const cols = await page.locator('[data-sz-grid] > div').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(cols).toBeGreaterThanOrEqual(2)
  const cdp = await page.context().newCDPSession(page)
  const box = (await page.locator('[data-sz-item][data-index="2"]').boundingBox())!
  const probe = await startRecording(page, 'grid', box.x + 40, box.y + 20)
  await ctrlWheel(cdp, page, box.x + 40, box.y + 20, -15, 25)
  await settle(page, 'grid')
  const rec = await stopRecording(page)
  expect((await state(page, 'grid')).level).toBe(2)
  // The card holds while the zoom moves. The grid is still shorter than the
  // window at Full, so afterwards the borrowed room springs back and the
  // grid returns to its natural place, as with the original's bouncing physics.
  const drift = maxAbs(rec.map((r) => r.edge - probe.edge))
  console.log(`grid ctrl+wheel: max drift while zooming ${drift.toFixed(2)}px`)
  expect(drift).toBeLessThanOrEqual(2)
  await page.waitForTimeout(400)
  const end = await page.locator('[data-sz-grid]').evaluate((el) => ({
    scrollTop: el.scrollTop,
    blank: (el.querySelector('[data-sz-spacer]') as HTMLElement | null)?.offsetHeight ?? 0,
  }))
  expect(end.blank).toBe(0)
  expect(await edgeOf(page, 'grid', probe.index)).toBeGreaterThan(0)
  await page.screenshot({ path: 'artifacts/e2e/desktop-grid.png' })
})

test('reads: expandable text needs no controller', async ({ page }) => {
  await page.goto('./#reads')
  const card = page.locator('article').nth(2)
  await expect(card).toContainText('我们坐火车去了波尔图')
  await card.getByRole('button', { name: 'Show more' }).click()
  await expect(card).toContainText('，沿着海岸线一路向北')
  await card.getByRole('button', { name: 'Show more' }).click()
  await expect(card).toContainText('窗外的风景非常美丽。')
  await expect(card.getByRole('button', { name: 'Show less' })).toBeVisible()
})
