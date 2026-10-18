# semantic-zoom-react

**Pinch to change how much a list says, not how big it is.**

A React port of the Flutter package
[semantic_zoom](https://github.com/Roshendz/semantic_zoom) by Roshen De Zoysa
(MIT). Pinch out and every entry grows from a title, to a one-line summary,
to the full text. The font size never changes. Words already on screen slide
to their new spots and new words fade in around them. The entry under your
fingers stays where it is.

**Live demo:** https://sz-demo.suntorai.com (best on a phone: pinch the list; on a desktop use ctrl + scroll, a trackpad pinch, or Ctrl/⌘ + / −). It is served from a developer machine, so it can be offline.

It is not published to npm.

- Core: zero runtime dependencies. React ≥ 18.2 is a peer dependency.
- Size: about 44 KB minified, 16 KB gzipped (everything, including the React components).
- Behaviour is ported item by item from the original source; see
  [docs/behavior.md](docs/behavior.md) (R-01 … R-83).

## Quick start

```tsx
import {
  LeveledText,
  LeveledTextView,
  LevelSwitcher,
  SemanticZoomList,
  useSemanticZoomController,
} from 'semantic-zoom-react'

// Create texts once, with your data, not in render.
const entries = [
  // plain = brief, [brackets] = medium, {braces} = full
  LeveledText.parse('[Took] Tram 28 [up] to **Alfama**{, standing room only}[. Found a tiny bakery.]'),
  // or plain versions, briefest first (e.g. from an LLM)
  LeveledText.fromVersions(['Port tasting', 'Port tasting in Gaia', 'Port tasting in Gaia: tawny, ruby and a white.']),
]

export function Journal() {
  const zoom = useSemanticZoomController({ levelLabels: ['Brief', 'Summary', 'Full'] })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <SemanticZoomList
        controller={zoom}
        style={{ flex: 1, minHeight: 0 }}
        itemCount={entries.length}
        renderItem={(i) => (
          // Tap one entry to step just that entry.
          <div onClick={() => zoom.setItemLevel(i, (zoom.itemLevel(i) + 1) % 3)} style={{ padding: 16 }}>
            <LeveledTextView text={entries[i]} itemId={i} />
          </div>
        )}
      />
      {/* Pinch isn't discoverable: always offer buttons too. */}
      <LevelSwitcher controller={zoom} />
    </div>
  )
}
```

Don't put padding or borders on the `LeveledTextView` element itself; put
them on a wrapper. The view positions words relative to its own box. Give it
a definite width (a block, or `w-full` in a flex row); in a shrink-to-fit
parent its width is held while words move and follows the new text after.
Inside chat bubbles, `clip` keeps the next level's words inside the bubble
while they fade in.

## Input

| Input | How it is handled |
|---|---|
| Touch pinch (phones) | Pointer Events track the two fingers. `touch-action: pan-x pan-y` keeps one-finger scrolling and stops the browser's own pinch-zoom; a non-passive `touchmove` listener cancels native scrolling while two fingers are down. |
| Trackpad pinch (Chrome, Edge, Firefox) | Arrives as `wheel` with `ctrlKey`; handled with `passive: false` and `preventDefault()`. A mouse wheel notch with Ctrl moves about one level. |
| Safari (macOS trackpad, iOS) | `gesturestart` / `gesturechange` / `gestureend`, all prevented. |
| Keyboard | Ctrl/⌘ + `=` `+` → more, `-` → less, `0` → level 0. `keyboardShortcuts="focus"` (default) or `"global"`. |
| Code | `zoom.setLevel(n)`, `zoom.jumpToLevel(n)`, `zoom.step(±1)`, `zoom.setItemLevel(id, n)`. |

A pinch never ends in a click on the item under the fingers.

## Lists, chats and grids

```tsx
<SemanticZoomList controller={zoom} itemCount={n} renderItem={...} />          // normal list
<SemanticZoomList controller={zoom} reverse itemCount={n} renderItem={...} />  // chat: item 0 is newest, at the bottom
<SemanticZoomGrid controller={zoom} maxColumnWidth={380} gap={12} ... />        // or columns={2}
```

For your own scroll container, use `useSemanticZoomScroller(ref, zoom, { reverse })`
and mark anchorable items with `data-sz-item`.

## Load on demand

```tsx
const loader = LeveledTextLoader.versions({ brief: visit.title, load: () => api.fetchSummaries(visit.id) })

<LazyLeveledTextView
  loader={loader}
  itemId={visit.id}
  renderLoading={() => <Progress />}
  renderError={(error, retry) => <button onClick={retry}>Retry</button>}
/>
```

Loading starts when the entry starts to zoom. The new words morph in over
350 ms while the first visible entry stays still.

## Summaries from an LLM

```ts
import { LeveledPrompt, LeveledText } from 'semantic-zoom-react'

const prompt = LeveledPrompt.build({ source: notes, instructions: 'Write in Chinese.' })
const reply = await yourModel.complete(prompt)        // no model calls are built in
const versions = LeveledPrompt.parseResponse(reply)   // tolerates ```json fences and chatter
const report = LeveledText.checkVersions(versions)    // isStrict, smoothness 0..1, issues[]
const text = LeveledText.fromVersions(versions)       // rewrites still cross-fade
```

## Accessibility

- At rest, each entry is plain, selectable text. Screen readers read the
  whole text of the current level.
- While words move, the word-by-word layer is `aria-hidden`; the real text
  stays in the accessibility tree.
- `LevelSwitcher` is a radio group with arrow-key support.
- `prefers-reduced-motion: reduce`: levels switch without word animation,
  during a pinch too.

## How it works

1. **Layout, once per level.** For each (level, width) the text is laid out
   by the browser in an invisible copy, one `<span>` per token, and every
   token's box is read back. Results are cached. Off-screen entries are
   measured while the browser is idle.
2. **Every frame.** One `requestAnimationFrame` per controller: springs
   advance; every visible entry writes `transform` and `opacity` for its
   tokens and its interpolated height; off-screen entries only write their
   height.
3. **Anchoring.** Then each list reads its anchored item once and corrects
   `scrollTop` by the drift, before the browser paints. If a short list
   needs to scroll past its end, room is borrowed after the content and
   springs back afterwards (like Flutter's bouncing scroll physics).
4. **At rest** the word layer is hidden and the real text is shown again.

## Develop

```sh
bun install
bun run dev          # demo on http://localhost:5188
bun run test         # unit tests (Vitest)
bun run e2e          # Playwright: phone Chromium (CDP touch), desktop Chromium, phone WebKit
bun run build        # library to dist/
```

The live demo is `demo/dist` served by `~/.sz-demo/server.ts` (port 3041) behind the
Cloudflare tunnel `sz-demo` (`~/.cloudflared/sz-demo.yml`), both in screen sessions
`sz-demo-web` and `sz-demo-tunnel`. To update it: `bun run build:demo`, copy
`demo/dist` into a new `~/.sz-demo/releases/<date>-<sha>` and repoint `~/.sz-demo/current`.

## Credits and license

MIT. The original Flutter package
[semantic_zoom](https://github.com/Roshendz/semantic_zoom) is
Copyright (c) 2026 Roshen De Zoysa, MIT licensed. Its algorithms (token
stream, LCS alignment, fade curves, spring, anchoring rules, prompt text) and
its demo content are ported here; see [LICENSE](LICENSE).
