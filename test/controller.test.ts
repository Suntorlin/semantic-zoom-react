import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type AnchorClient, SemanticZoomController } from '../src/core/controller'

// Drives frames by hand: time only moves when the test says so.
let t = 0
beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
})
afterEach(() => vi.restoreAllMocks())

function run(c: SemanticZoomController, seconds: number) {
  const end = t + seconds * 1000
  while (t < end) {
    t += 1000 / 120
    c.flushFrame()
  }
}

function client() {
  const log: string[] = []
  const c: AnchorClient = {
    captureAnchorAt: (x, y) => (log.push(`at ${x},${y}`), true),
    captureLeadingAnchor: () => (log.push('leading'), true),
    correct: () => void log.push('correct'),
    releaseAnchor: () => void log.push('release'),
  }
  return { c, log }
}

describe('SemanticZoomController', () => {
  test('commits the level when the settle starts, then springs to it (R-35)', async () => {
    const c = new SemanticZoomController({ reduceMotion: false, haptics: false })
    const heard: number[] = []
    c.subscribe(() => heard.push(c.level))
    const done = c.animateToLevel(2)
    expect(c.level).toBe(2)
    expect(heard).toEqual([2])
    expect(c.value).toBe(0)
    run(c, 0.1)
    expect(c.value).toBeGreaterThan(0)
    expect(c.value).toBeLessThan(2)
    run(c, 1)
    expect(c.value).toBe(2)
    expect(c.isAnimating).toBe(false)
    await done
  })

  test('reduce motion jumps (R-37)', () => {
    const c = new SemanticZoomController({ reduceMotion: true, haptics: false })
    void c.animateToLevel(1)
    expect(c.value).toBe(1)
    expect(c.isAnimating).toBe(false)
  })

  test('a gesture anchors at the fingers, ends on the projected level and releases after settling (R-46, R-50)', () => {
    const c = new SemanticZoomController({ reduceMotion: false, haptics: false })
    const { c: a, log } = client()
    c.addAnchorClient(a)
    c.beginGesture(10, 20)
    expect(log).toEqual(['at 10,20'])
    expect(c.isGesturing).toBe(true)
    c.value = 0.45
    c.flushFrame()
    void c.endGesture(0.45 + 1.2 * 0.12, 1.2) // a quick flick carries 0.45 to 1
    expect(c.level).toBe(1)
    expect(c.isGesturing).toBe(false)
    run(c, 1)
    expect(c.value).toBe(1)
    expect(log.filter((l) => l === 'release')).toHaveLength(1)
    // Released only after the last settle frame was corrected.
    expect(log[log.indexOf('release') - 1]).toBe('correct')
    // No second anchor was taken by the settle (the pinch owns it).
    expect(log.filter((l) => l === 'leading')).toHaveLength(0)
  })

  test('buttons anchor the leading item', () => {
    const c = new SemanticZoomController({ reduceMotion: false, haptics: false })
    const { c: a, log } = client()
    c.addAnchorClient(a)
    void c.setLevel(1)
    expect(log[0]).toBe('leading')
    run(c, 1)
    expect(log.filter((l) => l === 'release')).toHaveLength(1)
  })

  test('per-item levels: only that item moves; a gesture pulls it back (R-62..R-64)', () => {
    const c = new SemanticZoomController({ reduceMotion: false, haptics: false })
    c.setItemLevel('x', 2)
    expect(c.itemLevel('x')).toBe(2)
    expect(c.itemLevel('y')).toBe(0)
    expect(c.hasItemLevels).toBe(true)
    run(c, 1)
    expect(c.valueFor('x')).toBe(2)
    expect(c.valueFor('y')).toBe(0)
    c.beginGesture()
    expect(c.hasItemLevels).toBe(false)
    run(c, 1)
    expect(c.valueFor('x')).toBe(0)
  })

  test('holdAnchor nests and releases with the last hold (R-52)', () => {
    const c = new SemanticZoomController({ reduceMotion: false, haptics: false })
    const { c: a, log } = client()
    c.addAnchorClient(a)
    const r1 = c.holdAnchor()
    const r2 = c.holdAnchor()
    expect(log).toEqual(['leading'])
    r1()
    r1()
    c.flushFrame()
    expect(log).not.toContain('release')
    r2()
    c.flushFrame()
    expect(log.at(-1)).toBe('release')
  })

  test('labels and validation', () => {
    expect(new SemanticZoomController().labelForLevel(1)).toBe('Detail 2 of 3')
    expect(new SemanticZoomController({ levelLabels: ['a', 'b', 'c'] }).labelForLevel(2)).toBe('c')
    expect(() => new SemanticZoomController({ levelCount: 1 })).toThrow()
    expect(() => new SemanticZoomController({ levelLabels: ['a'] })).toThrow()
  })

  test('step() moves one level and clamps', () => {
    const c = new SemanticZoomController({ reduceMotion: true, haptics: false })
    expect(c.step(-1)).toBe(false)
    expect(c.step(1)).toBe(true)
    expect(c.step(5)).toBe(true)
    expect(c.level).toBe(2)
  })
})
