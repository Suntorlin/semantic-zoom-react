// Desktop size (1280×800), Chromium: ctrl + wheel (trackpad pinch) and keyboard shortcuts.
import { expect, test } from '@playwright/test'
import { ctrlWheel, edgeOf, maxAbs, open, settle, startRecording, state, stopRecording } from './helpers'

test('ctrl + wheel zooms the list, not the page; anchor stays put', async ({ page }) => {
  await open(page, 'travel')
  const cdp = await page.context().newCDPSession(page)
  const box = (await page.locator('[data-sz-item][data-index="3"]').boundingBox())!
  const x = box.x + 100
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  const dpr = await page.evaluate(() => devicePixelRatio)
  const probe = await startRecording(page, 'travel', x, y)
  // A trackpad pinch-out arrives as small negative deltas with ctrlKey.
  await ctrlWheel(cdp, page, x, y, -12, 30)
  await settle(page, 'travel')
  const rec = await stopRecording(page)
  const after = await edgeOf(page, 'travel', probe.index)
  const s = await state(page, 'travel')
  console.log(`ctrl+wheel: level ${s.level}, max drift ${maxAbs(rec.map((r) => r.edge - probe.edge)).toFixed(2)}px`)
  expect(s.level).toBe(2)
  expect(Math.abs(after - probe.edge)).toBeLessThanOrEqual(2)
  // The browser's own zoom did not change.
  expect(await page.evaluate(() => devicePixelRatio)).toBe(dpr)
  expect(await page.evaluate(() => visualViewport!.scale)).toBe(1)

  await ctrlWheel(cdp, page, x, y, 12, 30)
  await settle(page, 'travel')
  expect((await state(page, 'travel')).level).toBe(0)
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
  await open(page, 'health')
  const cols = await page.locator('[data-sz-grid] > div').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(cols).toBeGreaterThanOrEqual(2)
  const cdp = await page.context().newCDPSession(page)
  const box = (await page.locator('[data-sz-item][data-index="2"]').boundingBox())!
  const probe = await startRecording(page, 'health', box.x + 40, box.y + 20)
  await ctrlWheel(cdp, page, box.x + 40, box.y + 20, -15, 25)
  await settle(page, 'health')
  await stopRecording(page)
  expect((await state(page, 'health')).level).toBe(2)
  expect(Math.abs((await edgeOf(page, 'health', probe.index)) - probe.edge)).toBeLessThanOrEqual(2)
  await page.screenshot({ path: 'artifacts/e2e/desktop-health.png' })
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
