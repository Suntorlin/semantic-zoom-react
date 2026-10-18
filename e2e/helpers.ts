import type { CDPSession, Page } from '@playwright/test'

export type Tab = 'chat' | 'travel' | 'grid' | 'inbox' | 'reads' | 'perf'

export async function open(page: Page, tab: Tab) {
  await page.goto(`./#${tab}`)
  await page.waitForFunction((t) => !!window.__sz?.[t], tab)
  await page.waitForTimeout(300)
}

export interface Probe {
  /** Item whose leading edge is tracked. */
  index: string
  /** Leading edge before the gesture (top, or bottom in a chat). */
  edge: number
}

/**
 * Starts recording, after every controller frame, the anchored item's
 * leading edge, the zoom, and the browser's own page zoom.
 */
export async function startRecording(page: Page, tab: Tab, x: number, y: number): Promise<Probe> {
  return page.evaluate(
    ([tab, x, y]) => {
      const reverse = tab === 'chat'
      const hit = document.elementFromPoint(x as number, y as number)?.closest<HTMLElement>('[data-sz-item]')
      if (!hit) throw new Error('no item under the point')
      const edgeOf = (el: Element) => (reverse ? el.getBoundingClientRect().bottom : el.getBoundingClientRect().top)
      const c = window.__sz![tab as string]
      const w = window as unknown as { __rec: { z: number; edge: number; vv: number; morphing: number }[]; __off?: () => void }
      w.__off?.()
      w.__rec = []
      w.__off = c.addFrameListener(() => {
        w.__rec.push({
          z: c.value,
          edge: edgeOf(hit),
          vv: window.visualViewport?.scale ?? 1,
          morphing: document.querySelectorAll('[data-sz-morph]:not([style*="display: none"])').length,
        })
      })
      return { index: hit.dataset.index!, edge: edgeOf(hit) }
    },
    [tab, x, y] as const,
  )
}

export async function stopRecording(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __rec: { z: number; edge: number; vv: number; morphing: number }[]; __off?: () => void }
    w.__off?.()
    w.__off = undefined
    return w.__rec
  })
}

export async function edgeOf(page: Page, tab: Tab, index: string) {
  return page.evaluate(
    ([tab, index]) => {
      const el = document.querySelector(`[data-sz-item][data-index="${index}"]`)!
      const r = el.getBoundingClientRect()
      return tab === 'chat' ? r.bottom : r.top
    },
    [tab, index] as const,
  )
}

export async function state(page: Page, tab: Tab) {
  return page.evaluate((tab) => {
    const c = window.__sz![tab]
    return { level: c.level, value: c.value, items: c.itemLevels.size, animating: c.isAnimating }
  }, tab)
}

export async function settle(page: Page, tab: Tab) {
  await page.waitForFunction((tab) => {
    const c = window.__sz![tab]
    return !c.isAnimating && !c.isGesturing && Math.abs(c.value - Math.round(c.value)) < 1e-6
  }, tab)
  await page.waitForTimeout(100)
}

/** Two-finger pinch through CDP: page.mouse can't do it. */
export async function pinch(
  cdp: CDPSession,
  page: Page,
  { x, y, from, to, steps = 20, stepMs = 16, angle = 90 }: { x: number; y: number; from: number; to: number; steps?: number; stepMs?: number; angle?: number },
) {
  const rad = (angle * Math.PI) / 180
  const pts = (d: number) => [
    { x: x - (Math.cos(rad) * d) / 2, y: y - (Math.sin(rad) * d) / 2, id: 1 },
    { x: x + (Math.cos(rad) * d) / 2, y: y + (Math.sin(rad) * d) / 2, id: 2 },
  ]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + ((to - from) * i) / steps) })
    await page.waitForTimeout(stepMs)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** One-finger vertical drag through CDP. */
export async function swipe(cdp: CDPSession, page: Page, x: number, y0: number, y1: number, steps = 12) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps, id: 1 }] })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** Ctrl + wheel through CDP (a trackpad pinch arrives like this in Chrome). */
export async function ctrlWheel(cdp: CDPSession, page: Page, x: number, y: number, deltaY: number, count: number) {
  for (let i = 0; i < count; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY, modifiers: 2 })
    await page.waitForTimeout(16)
  }
}

export const maxAbs = (xs: number[]) => xs.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
