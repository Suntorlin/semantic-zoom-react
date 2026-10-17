// Ported from test/leveled_prompt_test.dart of semantic_zoom.
import { describe, expect, test } from 'vitest'
import { LeveledText } from '../src/core/leveled-text'
import { LeveledPrompt, LeveledPromptFormatError } from '../src/core/leveled-prompt'

describe('LeveledPrompt.build (R-25)', () => {
  test('describes each level, the rules and the source', () => {
    const p = LeveledPrompt.build({ source: '  Patient seen for knee pain.  ' })
    expect(p).toContain('Write 3 versions')
    expect(p).toContain('1. a title of at most 6 words')
    expect(p).toContain('3. the complete text')
    expect(p).toContain('Only insert new words')
    expect(p).toContain('Do not add facts')
    expect(p).toContain('{"levels": ["version 1", "version 2", ...]}')
    expect(p.endsWith('"""\nPatient seen for knee pain.\n"""')).toBe(true)
  })

  test('custom levels, descriptions and instructions', () => {
    const p = LeveledPrompt.build({
      source: 'x',
      levels: 2,
      levelDescriptions: ['a subject line', 'a two-line summary'],
      instructions: 'Write in Italian.',
    })
    expect(p).toContain('Write 2 versions')
    expect(p).toContain('2. a two-line summary')
    expect(p).toContain('- Write in Italian.')
  })

  test('blank instructions add no rule', () => {
    const p = LeveledPrompt.build({ source: 'x', instructions: '   ' })
    expect(p).not.toMatch(/^- $/m)
  })

  test('stretches default descriptions to more levels', () => {
    const p = LeveledPrompt.build({ source: 'x', levels: 4 })
    expect(p).toContain('2. a summary of about 25 words')
    expect(p).toContain('3. a summary of about 50 words')
    expect(p).toContain('4. the complete text')
  })

  test('rejects bad arguments', () => {
    expect(() => LeveledPrompt.build({ source: 'x', levels: 1 })).toThrow(RangeError)
    expect(() => LeveledPrompt.build({ source: 'x', levelDescriptions: ['only one'] })).toThrow(RangeError)
  })

  test('its own example follows the rule it teaches', () => {
    for (const levels of [2, 3, 4]) {
      const p = LeveledPrompt.build({ source: 'x', levels })
      const json = p.split('\n').find((l) => l.startsWith('{"levels"'))!
      const example = LeveledPrompt.parseResponse(json)
      expect(example).toHaveLength(levels)
      const report = LeveledText.checkVersions(example)
      expect(report.isStrict).toBe(true)
      expect(report.issues).toEqual([])
    }
  })
})

describe('LeveledPrompt.parseResponse (R-26)', () => {
  const versions = ['A', 'A b', 'A b c.']

  test('plain JSON object', () => {
    expect(LeveledPrompt.parseResponse(JSON.stringify({ levels: versions }))).toEqual(versions)
  })

  test('code fence and surrounding chatter', () => {
    const reply = `Sure! Here you go:\n\`\`\`json\n${JSON.stringify({ levels: versions })}\n\`\`\`\nLet me know!`
    expect(LeveledPrompt.parseResponse(reply)).toEqual(versions)
  })

  test('code fence without a language tag, pretty-printed', () => {
    const reply = '```\n' + JSON.stringify({ levels: versions }, null, 2) + '\n```'
    expect(LeveledPrompt.parseResponse(reply)).toEqual(versions)
  })

  test('bare array, trimming whitespace', () => {
    expect(LeveledPrompt.parseResponse('[" A ", "A b"]')).toEqual(['A', 'A b'])
  })

  test('Chinese content survives', () => {
    expect(LeveledPrompt.parseResponse('```json\n{"levels":["部署成功","部署成功，耗时 3 分钟"]}\n```')).toEqual([
      '部署成功',
      '部署成功，耗时 3 分钟',
    ])
  })

  test('rejects replies without a list of strings', () => {
    for (const bad of ['no json here', '{"levels": []}', '{"levels": [1, 2]}', '{"other": ["a"]}', '{"levels": ["a",]']) {
      expect(() => LeveledPrompt.parseResponse(bad), bad).toThrow(LeveledPromptFormatError)
    }
  })
})
