// Phone size (393×852), Chromium with real touch input through CDP.
import { expect, test } from '@playwright/test'
import { edgeOf, maxAbs, open, pinch, settle, startRecording, state, stopRecording, swipe } from './helpers'

test.describe('pinch on a phone', () => {
  test('travel list: pinch out to Full, anchor stays put, page does not zoom', async ({ page }) => {
    await open(page, 'travel')
    const cdp = await page.context().newCDPSession(page)
    const width = await page.evaluate(() => document.documentElement.clientWidth)
    const probe = await startRecording(page, 'travel', 196, 540)
    await pinch(cdp, page, { x: 196, y: 540, from: 80, to: 220 })
    await settle(page, 'travel')
    const rec = await stopRecording(page)
    const after = await edgeOf(page, 'travel', probe.index)

    expect((await state(page, 'travel')).level).toBe(2)
    expect(rec.length).toBeGreaterThan(10)
    // Words actually morphed during the gesture.
    expect(rec.some((r) => r.morphing > 0)).toBe(true)
    const drift = rec.map((r) => r.edge - probe.edge)
    console.log(`travel pinch-out: ${rec.length} frames, max drift ${maxAbs(drift).toFixed(2)}px, final ${(after - probe.edge).toFixed(2)}px`)
    expect(Math.abs(after - probe.edge)).toBeLessThanOrEqual(2)
    expect(maxAbs(drift)).toBeLessThanOrEqual(2)
    // The browser itself never zoomed.
    expect(rec.every((r) => r.vv === 1)).toBe(true)
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1)
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(width)
    await page.screenshot({ path: 'artifacts/e2e/phone-travel-full.png' })
  })

  test('travel list: pinch back in to Highlights, then spring back to the top like the original', async ({ page }) => {
    await open(page, 'travel')
    const cdp = await page.context().newCDPSession(page)
    await pinch(cdp, page, { x: 196, y: 540, from: 80, to: 220 })
    await settle(page, 'travel')
    const probe = await startRecording(page, 'travel', 196, 420)
    await pinch(cdp, page, { x: 196, y: 420, from: 240, to: 70, steps: 24 })
    await settle(page, 'travel')
    const rec = await stopRecording(page)
    expect((await state(page, 'travel')).level).toBe(0)
    const drift = rec.map((r) => r.edge - probe.edge)
    // While the list can still scroll, the item under the fingers holds;
    // once the content is shorter than the screen it can't (R-48).
    console.log(`travel pinch-in: drift over first half ${maxAbs(drift.slice(0, drift.length / 2)).toFixed(2)}px`)
    expect(maxAbs(drift.slice(0, Math.floor(drift.length / 3)))).toBeLessThanOrEqual(2)
    expect(rec.every((r) => r.vv === 1)).toBe(true)
    // The room borrowed past the end springs back: no blank space is left.
    await page.waitForTimeout(400)
    const end = await page.locator('[data-sz-list]').evaluate((el) => ({
      scrollTop: el.scrollTop,
      spacer: (el.querySelector('[data-sz-spacer]') as HTMLElement | null)?.offsetHeight ?? 0,
    }))
    expect(end).toEqual({ scrollTop: 0, spacer: 0 })
  })

  test('a small pinch snaps back; rubber band past the last level', async ({ page }) => {
    await open(page, 'travel')
    const cdp = await page.context().newCDPSession(page)
    await pinch(cdp, page, { x: 196, y: 540, from: 100, to: 115, steps: 10, stepMs: 30 })
    await settle(page, 'travel')
    expect((await state(page, 'travel')).level).toBe(0)
    await startRecording(page, 'travel', 196, 540)
    await pinch(cdp, page, { x: 196, y: 540, from: 60, to: 300, steps: 20 })
    const rec = await stopRecording(page)
    await settle(page, 'travel')
    expect(Math.max(...rec.map((r) => r.z))).toBeGreaterThan(2)
    expect(Math.max(...rec.map((r) => r.z))).toBeLessThan(2.6)
    expect((await state(page, 'travel')).value).toBe(2)
  })

  test('AI chat (newest at the bottom): anchor is the bottom edge', async ({ page }) => {
    await open(page, 'chat')
    const cdp = await page.context().newCDPSession(page)
    const probe = await startRecording(page, 'chat', 120, 420)
    const widthBefore = (await page.getByTestId('reply-a19').boundingBox())!.width
    const pts = (d: number) => [
      { x: 196, y: 420 - d / 2, id: 1 },
      { x: 196, y: 420 + d / 2, id: 2 },
    ]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(80) })
    for (let d = 85; d <= 220; d += 5) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d) })
      await page.waitForTimeout(16)
      if (d === 130) {
        // Mid-gesture the bubbles keep their width (words never stack up vertically).
        const mid = await page.evaluate(() => ({
          morphing: document.querySelectorAll('[data-sz-morph]:not([style*="display: none"])').length,
          widths: [...document.querySelectorAll('[data-testid^="reply-"] [data-sz-text]')].map((el) => el.getBoundingClientRect().width),
        }))
        expect(mid.morphing).toBeGreaterThan(0)
        expect(Math.min(...mid.widths)).toBeGreaterThan(200)
        expect((await page.getByTestId('reply-a19').boundingBox())!.width).toBeCloseTo(widthBefore, 0)
        await page.screenshot({ path: 'artifacts/e2e/phone-chat-mid.png' })
      }
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await settle(page, 'chat')
    const rec = await stopRecording(page)
    const after = await edgeOf(page, 'chat', probe.index)
    expect((await state(page, 'chat')).level).toBe(2)
    const drift = rec.map((r) => r.edge - probe.edge)
    console.log(`chat pinch-out: ${rec.length} frames, max drift ${maxAbs(drift).toFixed(2)}px, final ${(after - probe.edge).toFixed(2)}px`)
    expect(Math.abs(after - probe.edge)).toBeLessThanOrEqual(2)
    expect(maxAbs(drift)).toBeLessThanOrEqual(2)
    expect(rec.every((r) => r.vv === 1)).toBe(true)
    await page.screenshot({ path: 'artifacts/e2e/phone-chat-full.png' })
  })

  test('AI chat: the newest message stays at the bottom after a level change', async ({ page }) => {
    await open(page, 'chat')
    const list = page.locator('[data-sz-list]')
    const bottomBefore = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-sz-item]')
      return items[items.length - 1].getBoundingClientRect().bottom
    })
    await page.getByRole('radio', { name: '看全部步骤' }).click()
    await settle(page, 'chat')
    const bottomAfter = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-sz-item]')
      return items[items.length - 1].getBoundingClientRect().bottom
    })
    expect(Math.abs(bottomAfter - bottomBefore)).toBeLessThanOrEqual(2)
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThanOrEqual(-1)
  })

  test('one finger still scrolls and does not zoom', async ({ page }) => {
    await open(page, 'chat')
    const cdp = await page.context().newCDPSession(page)
    const before = await page.locator('[data-sz-list]').evaluate((el) => el.scrollTop)
    await swipe(cdp, page, 200, 300, 650)
    await page.waitForTimeout(600)
    const after = await page.locator('[data-sz-list]').evaluate((el) => el.scrollTop)
    console.log(`one-finger swipe: scrollTop ${before} → ${after}`)
    expect(Math.abs(after - before)).toBeGreaterThan(100)
    const s = await state(page, 'chat')
    expect(s.level).toBe(0)
    expect(s.value).toBe(0)
  })

  test('tap expands only that reply; a pinch never counts as a tap; the next pinch resets it', async ({ page }) => {
    await open(page, 'chat')
    const reply = page.getByTestId('reply-a19')
    const id = 'a19'
    await reply.click()
    await settle(page, 'chat')
    let levels = await page.evaluate((id) => {
      const c = window.__sz!.chat
      return { mine: c.itemLevel(id), other: c.itemLevel('a18'), global: c.level }
    }, id)
    expect(levels).toEqual({ mine: 1, other: 0, global: 0 })
    await expect(reply.locator('[data-sz-flow]')).toContainText('搜索预计一天')

    const cdp = await page.context().newCDPSession(page)
    const box = (await reply.boundingBox())!
    await pinch(cdp, page, { x: box.x + box.width / 2, y: box.y + box.height / 2, from: 90, to: 200 })
    await settle(page, 'chat')
    levels = await page.evaluate((id) => {
      const c = window.__sz!.chat
      return { mine: c.itemLevel(id), other: c.itemLevel('a18'), global: c.level }
    }, id)
    expect(levels.global).toBe(2)
    expect(levels.mine).toBe(2)
    expect((await state(page, 'chat')).items).toBe(0)
  })

  test('screen readers get whole sentences of the current level, never word fragments', async ({ page }) => {
    await open(page, 'chat')
    const reply = page.getByTestId('reply-a0')
    // At rest: one real text node per sentence, morph layer absent or hidden.
    await expect(reply.locator('[data-sz-flow]')).toHaveText(
      '白屏原因是新版本的 service worker 缓存了旧的 index.html。',
    )
    const cdp = await page.context().newCDPSession(page)
    await page.locator('[data-sz-list]').evaluate((el) => (el.scrollTop = -1e6))
    await page.waitForTimeout(200)
    const box = (await reply.boundingBox())!
    // Mid-gesture: the word-by-word layer is hidden from assistive tech.
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 196, y: box.y + 10, id: 1 },
        { x: 196, y: box.y + 90, id: 2 },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 196, y: box.y - 20, id: 1 },
        { x: 196, y: box.y + 120, id: 2 },
      ],
    })
    await page.waitForTimeout(100)
    const mid = await reply.evaluate((el) => {
      const morph = el.querySelector('[data-sz-morph]')
      return { morphHidden: morph?.getAttribute('aria-hidden'), flow: el.querySelector('[data-sz-flow]')!.textContent }
    })
    expect(mid.morphHidden).toBe('true')
    expect(mid.flow).toBe('白屏原因是新版本的 service worker 缓存了旧的 index.html。')
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await settle(page, 'chat')
    const snapshot = await reply.ariaSnapshot()
    expect(snapshot).toContain('3. 在 SW 里加上 skipWaiting 和 clients.claim，并按版本号清理旧缓存。')
    // The level buttons are a labelled radio group.
    await expect(page.getByRole('radiogroup', { name: '详细程度' })).toBeVisible()
    await expect(page.getByRole('radio', { name: '看全部步骤' })).toHaveAttribute('aria-checked', 'true')
  })

  test('reduced motion: pinch switches levels without word animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, 'travel')
    const cdp = await page.context().newCDPSession(page)
    await startRecording(page, 'travel', 196, 540)
    await pinch(cdp, page, { x: 196, y: 540, from: 80, to: 220 })
    await page.waitForTimeout(100)
    const rec = await stopRecording(page)
    expect(rec.every((r) => r.morphing === 0)).toBe(true)
    // Settles without a spring: the value is already the level.
    const s = await state(page, 'travel')
    expect(s.level).toBe(2)
    expect(s.value).toBe(2)
    expect(s.animating).toBe(false)
  })

  test('inbox: longer versions load on demand with a placeholder', async ({ page }) => {
    await open(page, 'inbox')
    const first = page.locator('[data-sz-item][data-index="0"]')
    await expect(first).toContainText('Onboarding mockups ready for review')
    await first.click()
    await expect(first.getByRole('progressbar')).toBeVisible()
    await expect(first.getByRole('progressbar')).toBeHidden({ timeout: 3000 })
    await settle(page, 'inbox')
    await expect(first.locator('[data-sz-flow]')).toHaveText('Onboarding mockups from Maya are ready for review by Thursday')
    // Others did not load.
    await expect(page.locator('[data-sz-item][data-index="1"] [data-sz-flow]')).toHaveText('Checkout crash fixed')
  })

  test('grid on a phone is one column and zooms with the buttons', async ({ page }) => {
    await open(page, 'grid')
    const cols = await page.locator('[data-sz-grid] > div').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(1)
    await page.getByRole('radio', { name: 'Full' }).click()
    await settle(page, 'grid')
    await expect(page.locator('[data-sz-item][data-index="0"] [data-sz-flow]')).toContainText('Pastéis de nata')
  })
})

test.describe('performance', () => {
  test('240 items: frame cost while pinching, 4× CPU slowdown', async ({ page }) => {
    await open(page, 'perf')
    // Let the idle pre-measurement finish, as it would before a real pinch.
    await page.waitForTimeout(2500)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_RATE ?? 4) })
    await page.evaluate(() => {
      const c = window.__sz!.perf
      c.frameStats.enabled = true
      c.frameStats.work.length = 0
      const w = window as unknown as { __raf: number[]; __rafOn: boolean }
      w.__raf = []
      w.__rafOn = true
      let last = performance.now()
      const loop = (t: number) => {
        w.__raf.push(t - last)
        last = t
        if (w.__rafOn) requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    })
    for (const [from, to] of [
      [80, 220],
      [240, 70],
      [80, 220],
    ]) {
      await pinch(cdp, page, { x: 196, y: 420, from, to, steps: 40, stepMs: 16 })
      await settle(page, 'perf')
    }
    const stats = await page.evaluate(() => {
      const c = window.__sz!.perf
      const w = window as unknown as { __raf: number[]; __rafOn: boolean }
      w.__rafOn = false
      return { work: [...c.frameStats.work], raf: w.__raf.slice(2) }
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    const sorted = [...stats.work].sort((a, b) => a - b)
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    const within = (ms: number) => stats.raf.filter((d) => d <= ms).length / stats.raf.length
    const summary = {
      frames: stats.work.length,
      workMedian: pct(0.5),
      workP95: pct(0.95),
      workMax: sorted[sorted.length - 1],
      rafWithin16_7: within(16.7 * 1.15),
      rafWithin33: within(33.4),
    }
    console.log('PERF', JSON.stringify(summary))
    await page.evaluate((s) => localStorage.setItem('perf', JSON.stringify(s)), summary)
    expect(summary.frames).toBeGreaterThan(50)
    // Under 4× slowdown a frame's own work should still fit a 60 Hz budget.
    expect(summary.workP95).toBeLessThan(16.7)
  })
})
