// Ported from test/leveled_text_test.dart, test/cjk_text_test.dart and
// test/align_lines_test.dart of semantic_zoom.
import { describe, expect, test } from 'vitest'
import { LeveledText, diffWords, graphemes, segmentWord, tokenize } from '../src/core/leveled-text'

const texts = (t: LeveledText) => t.tokens.map((k) => k.text)

describe('LeveledText.parse', () => {
  test('assigns levels and glue (R-06, R-09, R-10)', () => {
    const t = LeveledText.parse('tram{, old} [to] Alfama.')
    expect(t.tokens.map((k) => [k.text, k.minLevel, k.glued])).toEqual([
      ['tram', 0, false],
      [',', 2, true],
      ['old', 2, false],
      ['to', 1, false],
      ['Alfama', 0, false],
      ['.', 0, true],
    ])
  })

  test('renders each level (R-04)', () => {
    const t = LeveledText.parse('[Took] Tram 28 [up] to Alfama{, standing room only,} [and walked.]')
    expect(t.maxLevel).toBe(2)
    expect(t.textAt(0)).toBe('Tram 28 to Alfama')
    expect(t.textAt(1)).toBe('Took Tram 28 up to Alfama and walked.')
    expect(t.textAt(2)).toBe('Took Tram 28 up to Alfama, standing room only, and walked.')
  })

  test('collapses paragraphs that are empty at a level', () => {
    const t = LeveledText.parse('a\n[b]\nc')
    expect(t.textAt(0)).toBe('a\nc')
    expect(t.textAt(1)).toBe('a\nb\nc')
  })

  for (const bad of ['[a', 'a]', '[a {b}]', '{a]', 'a}']) {
    test(`rejects "${bad}"`, () => {
      expect(() => LeveledText.parse(bad)).toThrow(SyntaxError)
    })
  }

  test('equality is by tokens', () => {
    expect(LeveledText.parse('a [b]').equals(LeveledText.parse('a [b]'))).toBe(true)
    expect(LeveledText.parse('a [b]').equals(LeveledText.parse('a {b}'))).toBe(false)
  })
})

describe('rich markup (R-07, R-08)', () => {
  test('bold, italic and links in parse', () => {
    const t = LeveledText.parse('Tram **28**[ to *Alfama*]{, see [the map](https://ex.am/p).}')
    expect(t.textAt(0)).toBe('Tram 28')
    expect(t.textAt(2)).toBe('Tram 28 to Alfama, see the map.')
    const by = Object.fromEntries(t.tokens.map((k) => [k.text, k]))
    expect(by['28'].style).toEqual({ bold: true })
    expect(by['Alfama'].style).toEqual({ italic: true })
    expect(by['Alfama'].minLevel).toBe(1)
    expect(by['the'].link).toBe('https://ex.am/p')
    expect(by['map'].link).toBe('https://ex.am/p')
    expect(by['map'].minLevel).toBe(2)
    expect(by['see'].link).toBeNull()
  })

  test('a bracket group without (url) is still a level', () => {
    const t = LeveledText.parse('[Took] a [tram](x) up')
    expect(t.textAt(0)).toBe('a tram up')
    expect(t.textAt(1)).toBe('Took a tram up')
    expect(t.tokens.find((k) => k.text === 'tram')!.link).toBe('x')
  })

  test('style changes inside a word keep it glued', () => {
    const t = LeveledText.parse('**Note:** read this')
    expect(t.textAt(0)).toBe('Note: read this')
    expect(t.tokens[0].style).toEqual({ bold: true })
    expect(t.tokens[1].text).toBe(':')
    expect(t.tokens[1].glued).toBe(true)
    expect(t.tokens[2].style).toBeNull()
  })

  test('lone asterisks and escapes stay literal', () => {
    expect(LeveledText.parse('5 * 3 = 15').textAt(0)).toBe('5 * 3 = 15')
    const t = LeveledText.parse('\\[not a level\\] and \\*literal\\*')
    expect(t.textAt(0)).toBe('[not a level] and *literal*')
    expect(t.tokens.every((k) => k.style === null)).toBe(true)
  })

  test('fromVersions reads markdown from LLM output', () => {
    const t = LeveledText.fromVersions([
      'Tram ride',
      'Tram ride: **worth the queue**',
      'Tram ride: **worth the queue** twice over, see [plan](p1).',
    ])
    expect(t.textAt(1)).toBe('Tram ride: worth the queue')
    expect(t.textAt(2)).toBe('Tram ride: worth the queue twice over, see plan.')
    expect(t.tokens.find((k) => k.text === 'queue')!.style).toEqual({ bold: true })
    expect(t.tokens.find((k) => k.text === 'plan')!.link).toBe('p1')
  })

  test('brackets are literal in fromVersions', () => {
    expect(LeveledText.fromVersions(['a [b] c', 'a [b] c d']).textAt(0)).toBe('a [b] c')
  })
})

describe('LeveledText.fromVersions (R-15..R-20)', () => {
  test('derives levels from nested versions', () => {
    const t = LeveledText.fromVersions([
      'Port tasting',
      'Port tasting in Gaia today',
      'Port tasting in Gaia today with a surprising white.',
    ])
    expect(t.textAt(0)).toBe('Port tasting')
    expect(t.textAt(1)).toBe('Port tasting in Gaia today')
    expect(t.textAt(2)).toBe('Port tasting in Gaia today with a surprising white.')
    expect(t.tokens.map((e) => e.minLevel)).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 2, 2])
  })

  test('splits punctuation so versions round-trip exactly', () => {
    const versions = [
      'Q3 budget review',
      'Q3 budget review: spending improved, hiring unchanged',
      'Q3 budget review: travel spending averaged 4.2k/month over four ' +
        'months, spending improved, hiring unchanged. Review in three months.',
    ]
    const t = LeveledText.fromVersions(versions)
    versions.forEach((v, i) => expect(t.textAt(i)).toBe(v))
  })

  test('keeps paragraph breaks', () => {
    const t = LeveledText.fromVersions(['a b', 'a b\nc'])
    expect(t.textAt(0)).toBe('a b')
    expect(t.textAt(1)).toBe('a b\nc')
  })

  test('requireSubsequence rejects rewritten versions', () => {
    expect(() => LeveledText.fromVersions(['tram to Alfama', 'Alfama by tram'], { requireSubsequence: true })).toThrow(
      /"tram" is missing or out of order/,
    )
    expect(() => LeveledText.fromVersions(['a', 'a b'], { requireSubsequence: true })).not.toThrow()
  })

  test('rewritten versions share common words and swap the rest', () => {
    const versions = [
      'Tram to Alfama',
      'Took the tram up to Alfama at dawn',
      'Took the old tram up to Alfama, standing room only.',
    ]
    const t = LeveledText.fromVersions(versions)
    versions.forEach((v, i) => expect(t.textAt(i)).toBe(v))
    const find = (s: string) => t.tokens.find((e) => e.text === s)!
    expect([find('Alfama').minLevel, find('Alfama').maxLevel]).toEqual([0, null]) // slides
    expect([find('Tram').minLevel, find('Tram').maxLevel]).toEqual([0, 0]) // fades out
    expect([find('dawn').minLevel, find('dawn').maxLevel]).toEqual([1, 1]) // in at 1, out at 2
    expect(t.maxLevel).toBe(2)
    expect([...t.rewrittenLevels].sort()).toEqual([1, 2])
  })

  test('handles completely different versions', () => {
    const t = LeveledText.fromVersions(['Alpha beta', 'Gamma delta'])
    expect(t.textAt(0)).toBe('Alpha beta')
    expect(t.textAt(1)).toBe('Gamma delta')
  })

  test('supports more than three levels', () => {
    const t = LeveledText.fromVersions(['a', 'a b', 'a b c', 'a b c d'])
    expect(t.maxLevel).toBe(3)
    expect(t.textAt(3)).toBe('a b c d')
  })

  test('rejects an empty list', () => {
    expect(() => LeveledText.fromVersions([])).toThrow(RangeError)
  })

  test('matching is case-sensitive (R-18)', () => {
    const t = LeveledText.fromVersions(['Sunset walk, nothing planned', 'Long sunset walk with nothing else planned'])
    expect(t.tokens.find((k) => k.text === 'Sunset')!.maxLevel).toBe(0)
    expect(t.tokens.find((k) => k.text === 'walk')!.maxLevel).toBeNull()
    expect(t.tokens.find((k) => k.text === 'planned')!.maxLevel).toBeNull()
  })
})

describe('LCS diff (R-17)', () => {
  test('keeps the longest common subsequence', () => {
    const ops = diffWords(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e'])
    expect(ops.filter((o) => o[0] === 'keep').map((o) => o[1])).toEqual([0, 2, 3])
  })

  test('deletes come before inserts in a changed region', () => {
    expect(diffWords(['a', 'old', 'c'], ['a', 'new', 'c']).map((o) => o[0])).toEqual([
      'keep',
      'delete',
      'insert',
      'keep',
    ])
  })

  test('empty sides', () => {
    expect(diffWords([], ['a'])).toEqual([['insert', -1, 0]])
    expect(diffWords(['a'], [])).toEqual([['delete', 0, -1]])
    expect(diffWords([], [])).toEqual([])
  })

  test('the length of the kept run is the LCS length', () => {
    const a = 'the quick brown fox jumps over the lazy dog'.split(' ')
    const b = 'a quick red fox leaps over a very lazy dog today'.split(' ')
    const kept = diffWords(a, b).filter((o) => o[0] === 'keep')
    expect(kept.map((o) => a[o[1]])).toEqual(['quick', 'fox', 'over', 'lazy', 'dog'])
    for (const [, i, j] of kept) expect(a[i]).toBe(b[j])
  })
})

describe('tokenizer: unspaced scripts per character (R-11..R-14)', () => {
  test('parse splits characters so levels can grow inside a sentence', () => {
    const t = LeveledText.parse('我[非常]喜欢猫{和狗}。')
    expect(t.textAt(0)).toBe('我喜欢猫。')
    expect(t.textAt(1)).toBe('我非常喜欢猫。')
    expect(t.textAt(2)).toBe('我非常喜欢猫和狗。')
    expect(texts(t)).toEqual(['我', '非', '常', '喜', '欢', '猫', '和', '狗', '。'])
    expect(t.tokens.slice(1).every((k) => k.glued)).toBe(true)
  })

  test('fromVersions keeps shared characters in place', () => {
    const versions = ['我喜欢猫', '我非常喜欢猫']
    const t = LeveledText.fromVersions(versions)
    versions.forEach((v, i) => expect(t.textAt(i)).toBe(v))
    const report = LeveledText.checkVersions(versions)
    expect(report.isStrict).toBe(true)
    expect(report.smoothness).toBe(1)
    expect(report.transitions[0].kept).toBe(4)
  })

  test('Latin words and numbers inside Chinese stay whole', () => {
    const t = LeveledText.parse('我用Flutter开发了3个App')
    expect(texts(t)).toEqual(['我', '用', 'Flutter', '开', '发', '了', '3', '个', 'App'])
    expect(t.textAt(0)).toBe('我用Flutter开发了3个App')
  })

  test('spaces the author wrote are kept', () => {
    const t = LeveledText.parse('中文 English 中文')
    expect(t.textAt(0)).toBe('中文 English 中文')
    expect(t.tokens.map((k) => k.glued)).toEqual([false, true, false, false, true])
  })

  test('rich markup works around characters', () => {
    const t = LeveledText.parse('**北京**[和*上*海]')
    expect(t.textAt(1)).toBe('北京和上海')
    expect(t.tokens[0].style).toEqual({ bold: true })
    expect(t.tokens[1].style).toEqual({ bold: true })
    expect(t.tokens[2].style).toBeNull()
    expect(t.tokens[3].style).toEqual({ italic: true })
  })

  test('Japanese mixes kanji and kana per character', () => {
    const t = LeveledText.parse('今日は[とても]いい天気です。')
    expect(t.textAt(0)).toBe('今日はいい天気です。')
    expect(t.textAt(1)).toBe('今日はとてもいい天気です。')
    expect(texts(t).slice(0, 3)).toEqual(['今', '日', 'は'])
  })

  test('Thai splits into whole grapheme clusters and round-trips', () => {
    const src = 'สวัสดีครับ วันนี้อากาศดี'
    const t = LeveledText.parse(src)
    expect(t.textAt(0)).toBe(src)
    // One cluster per token: tone marks and vowels stay with their base.
    for (const k of t.tokens) expect(graphemes(k.text)).toHaveLength(1)
    expect(texts(t)).toContain('ดี')
  })

  test('levels grow inside a Thai sentence', () => {
    const t = LeveledText.fromVersions(['ไปตลาด', 'ไปตลาดเช้านี้'])
    expect(t.textAt(0)).toBe('ไปตลาด')
    expect(t.textAt(1)).toBe('ไปตลาดเช้านี้')
    expect(LeveledText.checkVersions(['ไปตลาด', 'ไปตลาดเช้านี้']).isStrict).toBe(true)
  })

  test('Sinhala keeps whole words, including joined letters', () => {
    const sri = 'ශ්‍රී'
    expect([...sri].map((c) => c.codePointAt(0))).toContain(0x200d)
    const t = LeveledText.parse(`ඇල්ල දක්වා **දුම්රිය** ගමන[, ${sri} ලංකාවේ ලස්සනම]`)
    expect(texts(t)).toEqual(['ඇල්ල', 'දක්වා', 'දුම්රිය', 'ගමන', ',', sri, 'ලංකාවේ', 'ලස්සනම'])
    expect(t.textAt(0)).toBe('ඇල්ල දක්වා දුම්රිය ගමන')
    expect(t.textAt(1)).toBe(`ඇල්ල දක්වා දුම්රිය ගමන, ${sri} ලංකාවේ ලස්සනම`)
    expect(t.tokens[2].style).toEqual({ bold: true })
  })

  test('Korean keeps its space-separated words', () => {
    expect(texts(LeveledText.parse('한국어 문장 입니다'))).toEqual(['한국어', '문장', '입니다'])
  })

  test('emoji clusters stay whole next to CJK', () => {
    expect(segmentWord('好👨‍👩‍👧好')).toEqual(['好', '👨‍👩‍👧', '好'])
  })

  test('tokenize splits punctuation off', () => {
    expect(tokenize('Hello, world!')).toEqual(['Hello', ',', 'world', '!'])
  })
})

describe('checkVersions (R-21..R-24)', () => {
  test('strict versions', () => {
    const r = LeveledText.checkVersions([
      'Train to Porto',
      'Train to Porto along the coast, window seat',
      'Train to Porto along the coast in three hours, window seat on the left.',
    ])
    expect(r.isStrict).toBe(true)
    expect(r.smoothness).toBe(1)
    expect(r.issues).toEqual([])
    expect(r.transitions[0].kept).toBe(3)
    expect(r.transitions[0].added).toBe(5)
  })

  test('rewrites are reported with the dropped words', () => {
    const r = LeveledText.checkVersions(['Checkout crash fixed', 'Android checkout crash is fixed in version 4.2.1'])
    expect(r.isStrict).toBe(false)
    expect(r.transitions[0].dropped).toEqual(['Checkout'])
    expect(r.smoothness).toBeCloseTo(2 / 3, 9)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]).toBe('Level 1 drops 1 word of level 0 ("Checkout"); they will cross-fade.')
  })

  test('unrelated versions warn that they will cross-fade', () => {
    const r = LeveledText.checkVersions(['Alpha beta', 'Gamma delta'])
    expect(r.smoothness).toBe(0)
    expect(r.issues.some((i) => i.includes('keeps only 0%'))).toBe(true)
  })

  test('more than five dropped words are elided', () => {
    const r = LeveledText.checkVersions(['a b c d e f g', 'h'])
    expect(r.issues[0]).toBe('Level 1 drops 7 words of level 0 ("a", "b", "c", "d", "e", …); they will cross-fade.')
  })

  test('identical and empty levels are flagged', () => {
    expect(LeveledText.checkVersions(['a b', 'a b']).issues).toContain('Level 1 adds nothing to level 0.')
    expect(LeveledText.checkVersions(['', 'a']).issues).toContain('Level 0 is empty.')
    expect(LeveledText.checkVersions(['only one']).issues).toEqual(['Provide at least two versions to morph between.'])
  })

  test('CJK punctuation does not count as a word', () => {
    const r = LeveledText.checkVersions(['好。', '很好。'])
    expect(r.transitions[0].kept).toBe(1)
    expect(r.transitions[0].added).toBe(1)
  })
})
