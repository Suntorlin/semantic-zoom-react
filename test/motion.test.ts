import { describe, expect, test } from 'vitest'
import {
  SpringSimulation,
  between,
  defaultSpring,
  easeInOutCubic,
  interval,
  rubberBand,
  smoothVelocity,
  snapLevel,
  tokenOpacity,
  zoomForScale,
} from '../src/core/motion'

describe('level interpolation (R-30, R-31, R-39)', () => {
  test('one doubling of finger distance moves 1.6 levels', () => {
    expect(zoomForScale(0, 2)).toBeCloseTo(1.6)
    expect(zoomForScale(1, 0.5)).toBeCloseTo(-0.6)
    expect(zoomForScale(0, 1)).toBe(0)
    expect(zoomForScale(0, 2, 1)).toBeCloseTo(1)
  })

  test('scale is floored so a zero distance does not explode', () => {
    expect(Number.isFinite(zoomForScale(0, 0))).toBe(true)
  })

  test('rubber band applies a quarter past the ends', () => {
    expect(rubberBand(1.3, 2)).toBe(1.3)
    expect(rubberBand(-1, 2)).toBe(-0.25)
    expect(rubberBand(3, 2)).toBe(2.25)
  })

  test('between picks the two levels and eases the progress', () => {
    expect(between(0, 2)).toEqual([0, 1, 0])
    expect(between(2, 2)).toEqual([2, 2, 0])
    const [lo, hi, move] = between(1.5, 2)
    expect([lo, hi]).toEqual([1, 2])
    // Flutter's easeInOutCubic is Cubic(0.645, 0.045, 0.355, 1.0): y(0.5) ≈ 0.517.
    expect(move).toBeCloseTo(0.517, 2)
    // Clamped while rubber-banding.
    expect(between(-0.2, 2)).toEqual([0, 1, 0])
    expect(between(2.2, 2)).toEqual([2, 2, 0])
  })

  test('easeInOutCubic is monotone and nearly symmetric', () => {
    let last = 0
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const y = easeInOutCubic(t)
      expect(y).toBeGreaterThanOrEqual(last - 1e-3)
      last = y
    }
    expect(Math.abs(easeInOutCubic(0.25) + easeInOutCubic(0.75) - 1)).toBeLessThan(0.03)
  })

  test('interval maps begin..end to 0..1', () => {
    const i = interval(0.25, 1)
    expect(i(0)).toBe(0)
    expect(i(0.25)).toBe(0)
    expect(i(0.625)).toBeCloseTo(0.5)
    expect(i(1)).toBe(1)
  })
})

describe('snapping (R-32, R-33)', () => {
  test('rounds the projected value and clamps it', () => {
    expect(snapLevel(0.4, 0, 2)).toBe(0)
    expect(snapLevel(0.6, 0, 2)).toBe(1)
    // A quick flick carries over: 0.4 + 2 × 0.12 = 0.64.
    expect(snapLevel(0.4, 2, 2)).toBe(1)
    expect(snapLevel(1.6, -1.5, 2)).toBe(1)
    expect(snapLevel(2.2, 5, 2)).toBe(2)
    expect(snapLevel(-0.2, -5, 2)).toBe(0)
  })

  test('velocity is lightly smoothed', () => {
    expect(smoothVelocity(0, 1, 0.1)).toBeCloseTo(3)
    expect(smoothVelocity(10, 0, 0.1)).toBeCloseTo(7)
    expect(smoothVelocity(5, 1, 0)).toBe(5)
  })
})

describe('spring (R-34)', () => {
  test('settles on the target within about half a second', () => {
    const s = new SpringSimulation(defaultSpring, 0.3, 1, 0)
    expect(s.positionAt(0)).toBeCloseTo(0.3)
    expect(s.isDone(0)).toBe(false)
    let t = 0
    while (!s.isDone(t) && t < 5) t += 1 / 120
    expect(t).toBeLessThan(0.7)
    expect(s.positionAt(t)).toBeCloseTo(1, 2)
  })

  test('is slightly under-damped: a fling overshoots a little', () => {
    const s = new SpringSimulation(defaultSpring, 0, 1, 0)
    let max = 0
    for (let t = 0; t < 1; t += 1 / 240) max = Math.max(max, s.positionAt(t))
    expect(max).toBeGreaterThan(1)
    expect(max).toBeLessThan(1.01)
  })

  test('carries the release velocity', () => {
    const s = new SpringSimulation(defaultSpring, 0.5, 1, 4)
    expect(s.velocityAt(0)).toBeCloseTo(4)
  })
})

describe('token opacity (R-42)', () => {
  const none = new Set<number>()

  test('level-0 words are always opaque', () => {
    expect(tokenOpacity(0, null, 0, none)).toBe(1)
    expect(tokenOpacity(0, null, 1.5, none)).toBe(1)
  })

  test('added words fade in over the last 75% of the step', () => {
    expect(tokenOpacity(1, null, 0, none)).toBe(0)
    expect(tokenOpacity(1, null, 0.25, none)).toBe(0)
    expect(tokenOpacity(1, null, 0.625, none)).toBeCloseTo(0.5)
    expect(tokenOpacity(1, null, 1, none)).toBe(1)
  })

  test('on rewritten levels new words arrive late and old ones leave early', () => {
    const rewritten = new Set([1])
    // At z = 0.4 the old word is gone and the new one has not started.
    expect(tokenOpacity(0, 0, 0.4, rewritten)).toBe(0)
    expect(tokenOpacity(1, null, 0.4, rewritten)).toBe(0)
    for (let z = 0; z <= 1; z += 0.05) {
      const old = tokenOpacity(0, 0, z, rewritten)
      const fresh = tokenOpacity(1, null, z, rewritten)
      expect(Math.min(old, fresh)).toBe(0)
    }
  })
})

test('snapping never yields -0', () => {
  expect(Object.is(snapLevel(-0.4, 0, 2), 0)).toBe(true)
})
