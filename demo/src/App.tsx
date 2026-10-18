// Demo app, styled with the HAQI web design system (haqi/web/DESIGN.md):
// monochrome tokens, pills and big radii, flat cards, 44px targets, light
// and dark. Colours come only from the --social-* variables in styles.css.
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  ExpandableLeveledText,
  LazyLeveledTextView,
  LeveledText,
  LeveledTextLoader,
  LeveledTextView,
  LevelSwitcher,
  type SemanticZoomController,
  SemanticZoomGrid,
  SemanticZoomList,
  useSemanticZoomController,
} from '../../src'
import { aiChat } from './data/ai-chat'
import { articles, threads, trip } from './data/original'

// Exposed for the end-to-end tests and benchmarks.
declare global {
  interface Window {
    __sz?: Record<string, SemanticZoomController>
  }
}
function useExpose(name: string, c: SemanticZoomController) {
  useEffect(() => {
    window.__sz ??= {}
    window.__sz[name] = c
  }, [name, c])
}

// ───────────────────────────── theme ─────────────────────────────

type Theme = 'light' | 'dark'
const THEME_KEY = 'sz-demo-theme'

const systemTheme = (): Theme => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

/** Follows the system until the user picks a theme; `?theme=dark` forces one (screenshots). */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const forced = new URLSearchParams(location.search).get('theme')
    if (forced === 'dark' || forced === 'light') return forced
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'dark' || saved === 'light' ? saved : systemTheme()
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--social-surface').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
  }, [theme])
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => {
      if (!localStorage.getItem(THEME_KEY)) setTheme(systemTheme())
    }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  return [theme, toggle]
}

// ───────────────────────────── icons ─────────────────────────────

const iconProps = (filled: boolean) => ({
  viewBox: '0 0 24 24',
  className: 'h-[25px] w-[25px]',
  fill: filled ? 'currentColor' : 'none',
  stroke: 'currentColor',
  strokeWidth: filled ? 0 : 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

const ICONS: Record<string, (filled: boolean) => ReactNode> = {
  chat: (f) => (
    <svg {...iconProps(f)}>
      <path d="M12 3.5c-4.97 0-9 3.47-9 7.75 0 2.33 1.2 4.42 3.09 5.84-.13 1.17-.62 2.33-1.44 3.25 1.9-.12 3.56-.8 4.73-1.73.84.25 1.72.39 2.62.39 4.97 0 9-3.47 9-7.75S16.97 3.5 12 3.5z" />
    </svg>
  ),
  travel: (f) => (
    <svg {...iconProps(f)}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      {!f && <circle cx="12" cy="10" r="2.3" />}
    </svg>
  ),
  grid: (f) => (
    <svg {...iconProps(f)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  ),
  inbox: (f) => (
    <svg {...iconProps(f)}>
      <path d="M3.5 13.5 6 5.5h12l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
      {!f && <path d="M3.5 13.5H8l1.2 2.2h5.6l1.2-2.2h4.5" />}
    </svg>
  ),
  reads: (f) => (
    <svg {...iconProps(f)}>
      <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
      {!f && <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />}
    </svg>
  ),
  perf: (f) => (
    <svg {...iconProps(f)}>
      <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
    </svg>
  ),
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </svg>
)
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
)

// ───────────────────────────── app ─────────────────────────────

const TABS = [
  { id: 'chat', label: 'AI 对话' },
  { id: 'travel', label: 'Travel' },
  { id: 'grid', label: 'Grid' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'reads', label: 'Reads' },
  { id: 'perf', label: '240 条' },
] as const
type TabId = (typeof TABS)[number]['id']

const tabFromHash = (): TabId => {
  const h = location.hash.slice(1)
  return (TABS.find((t) => t.id === h)?.id ?? 'chat') as TabId
}

export function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash)
  const [theme, toggleTheme] = useTheme()
  useEffect(() => {
    const on = () => setTab(tabFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'}
      title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
      className="social-pressable flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--social-fg)] active:scale-[.98]"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col bg-[var(--social-surface)]">
      <main className="relative min-h-0 flex-1">
        {tab === 'chat' && <ChatDemo action={themeButton} />}
        {tab === 'travel' && <TravelDemo action={themeButton} />}
        {tab === 'grid' && <GridDemo action={themeButton} />}
        {tab === 'inbox' && <InboxDemo action={themeButton} />}
        {tab === 'reads' && <ReadsDemo action={themeButton} />}
        {tab === 'perf' && <PerfDemo action={themeButton} />}
      </main>
      <nav className="social-bar relative z-20 shrink-0 border-t border-[var(--social-border)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-[50px]">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <a
                key={t.id}
                href={`#${t.id}`}
                aria-label={t.label}
                title={t.label}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 items-center justify-center rounded-xl ${
                  active ? 'text-[var(--social-fg)]' : 'text-[var(--social-fg-subtle)]'
                }`}
              >
                {ICONS[t.id](active)}
              </a>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

// ───────────────────────────── shared ─────────────────────────────

function Screen({
  title,
  subtitle,
  action,
  children,
  footer,
}: {
  title: string
  subtitle: string
  action: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col">
      <header className="social-bar z-10 flex shrink-0 items-center gap-2 border-b border-[var(--social-divider)] py-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold leading-7">{title}</h1>
          <p className="truncate text-[13px] text-[var(--social-fg-muted)]">{subtitle}</p>
        </div>
        {action}
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
      {footer}
    </div>
  )
}

/** HAQI's framed segmented control, driving the zoom level. */
function Levels({ controller, labels }: { controller: SemanticZoomController; labels: string[] }) {
  return (
    <div className="shrink-0 px-4 pt-2 pb-3">
      <div className="overflow-hidden rounded-2xl border border-[var(--social-border)]">
        <LevelSwitcher
          controller={controller}
          labels={labels}
          label="详细程度"
          className="flex gap-1 bg-[var(--social-muted)] p-1"
          buttonClassName="min-h-11 min-w-0 flex-1 truncate rounded-xl px-2 py-2 text-[15px] text-[var(--social-fg-muted)] transition-colors duration-150 hover:text-[var(--social-fg)] data-[active]:bg-[var(--social-surface)] data-[active]:font-semibold data-[active]:text-[var(--social-fg)] data-[active]:shadow-[var(--shadow-raised)]"
        />
      </div>
    </div>
  )
}

/** Tap one entry to step just that entry; after the last level it returns to the global one (R-65). */
function tapToExpand(controller: SemanticZoomController, id: unknown) {
  return (e: { target: EventTarget }) => {
    if ((e.target as Element).closest('a')) return
    if (window.getSelection()?.toString()) return
    const next = controller.itemLevel(id) + 1
    controller.setItemLevel(id, next > controller.maxLevel ? controller.level : next)
  }
}

const openLink = (href: string) => {
  const el = document.createElement('div')
  el.textContent = `Open ${href}`
  el.setAttribute('role', 'status')
  el.className =
    'social-card fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md truncate rounded-2xl px-4 py-3 text-[15px] shadow-[var(--shadow-float)]'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1800)
}

// A pressable row whose highlight stays inside its rounded shape.
const ROW = 'social-pressable cursor-pointer rounded-2xl'

// ───────────────────────────── AI chat ─────────────────────────────

const chatTexts = aiChat.map((t) => LeveledText.fromVersions(t.reply))
// Item 0 is the newest message (drawn at the bottom).
const chatItems = aiChat
  .flatMap((t, i) => [
    { kind: 'user' as const, text: t.user, time: t.time, id: `u${i}` },
    { kind: 'ai' as const, text: chatTexts[i], time: t.time, id: `a${i}` },
  ])
  .reverse()

function ChatDemo({ action }: { action: ReactNode }) {
  const labels = ['只看结论', '看摘要', '看全部步骤']
  const zoom = useSemanticZoomController({ levelLabels: labels })
  useExpose('chat', zoom)
  return (
    <Screen title="AI 对话" subtitle="双指捏合切换详细程度，或点一条只展开这一条" action={action} footer={<Levels controller={zoom} labels={labels} />}>
      <SemanticZoomList
        controller={zoom}
        reverse
        keyboardShortcuts="global"
        className="absolute inset-0 px-4 py-2"
        itemCount={chatItems.length}
        getItemKey={(i) => chatItems[i].id}
        itemClassName="py-1"
        renderItem={(i) => {
          const m = chatItems[i]
          if (m.kind === 'user') {
            return (
              <div className="flex justify-end pt-2">
                <div className="social-bubble-self max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-[1.55] break-words">
                  {m.text}
                </div>
              </div>
            )
          }
          return (
            <div
              className="social-card social-pressable w-[88%] cursor-pointer rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-[1.55]"
              onClick={tapToExpand(zoom, m.id)}
              data-testid={`reply-${m.id}`}
            >
              <LeveledTextView text={m.text} itemId={m.id} clip />
              <div className="mt-1 text-[12px] text-[var(--social-fg-subtle)]">{m.time}</div>
            </div>
          )
        }}
      />
    </Screen>
  )
}

// ───────────────────────────── Travel (same content as the original) ─────────────────────────────

function TravelDemo({ action }: { action: ReactNode }) {
  const zoom = useSemanticZoomController({ levelLabels: ['Highlights', 'Day summary', 'Full entry'] })
  useExpose('travel', zoom)
  return (
    <Screen
      title="Travel"
      subtitle="The original demo's content, side by side"
      action={action}
      footer={<Levels controller={zoom} labels={['Highlights', 'Summary', 'Full']} />}
    >
      <SemanticZoomList
        controller={zoom}
        keyboardShortcuts="global"
        className="absolute inset-0"
        contentClassName="px-2 pt-3 pb-8"
        header={
          // The original's 180px hero, monochrome as HAQI asks.
          <div className="mx-2 mb-1 flex h-[180px] flex-col justify-end rounded-2xl bg-[var(--social-muted)] p-5">
            <div className="text-[20px] font-semibold">Lisbon &amp; Porto</div>
            <div className="mt-1 text-[13px] text-[var(--social-fg-muted)]">Pinch the list, or tap one day</div>
          </div>
        }
        itemCount={trip.length}
        renderItem={(i) => {
          const [date, place, text] = trip[i]
          return (
            <div className={`${ROW} px-3 py-3`} onClick={tapToExpand(zoom, i)}>
              <div className="text-[13px]">
                <span className="font-semibold">{date}</span>
                <span className="text-[var(--social-fg-muted)]">{` · ${place}`}</span>
              </div>
              <div className="h-1" />
              <LeveledTextView text={text} itemId={i} onLinkTap={openLink} className="text-[15px] leading-[1.5]" />
            </div>
          )
        }}
      />
    </Screen>
  )
}

// ───────────────────────────── Grid: trip cards ─────────────────────────────

function GridDemo({ action }: { action: ReactNode }) {
  const zoom = useSemanticZoomController({ levelLabels: ['Highlights', 'Day summary', 'Full entry'] })
  useExpose('grid', zoom)
  return (
    <Screen
      title="Trip cards"
      subtitle="A grid: each row grows with its tallest card"
      action={action}
      footer={<Levels controller={zoom} labels={['Highlights', 'Summary', 'Full']} />}
    >
      <SemanticZoomGrid
        controller={zoom}
        keyboardShortcuts="global"
        className="absolute inset-0"
        contentClassName="px-4 pt-3 pb-4"
        maxColumnWidth={380}
        gap={12}
        itemCount={trip.length}
        renderItem={(i) => {
          const [date, place, text] = trip[i]
          return (
            <div className="social-card social-pressable cursor-pointer rounded-2xl p-4" onClick={tapToExpand(zoom, i)}>
              <div className="text-[13px]">
                <span className="font-semibold">{date}</span>
                <span className="text-[var(--social-fg-muted)]">{` · ${place}`}</span>
              </div>
              <div className="h-2" />
              <LeveledTextView text={text} itemId={i} onLinkTap={openLink} className="text-[15px] leading-[1.5]" />
            </div>
          )
        }}
      />
    </Screen>
  )
}

// ───────────────────────────── Inbox: load on demand ─────────────────────────────

const fakeLlm = (summaries: string[]) => new Promise<string[]>((r) => setTimeout(() => r(summaries), 900))

function InboxDemo({ action }: { action: ReactNode }) {
  const zoom = useSemanticZoomController({ levelLabels: ['Subjects', 'Short summaries', 'Detailed summaries'] })
  useExpose('inbox', zoom)
  // Only the subject is known up front; summaries are "generated" the first
  // time a thread is expanded, and kept for next time.
  const loaders = useMemo(
    () => threads.map(([, , v]) => LeveledTextLoader.versions({ brief: v[0], load: () => fakeLlm(v.slice(1)) })),
    [],
  )
  return (
    <Screen
      title="Inbox"
      subtitle="AI summaries, generated only when you pinch or tap"
      action={action}
      footer={<Levels controller={zoom} labels={['Subject', 'Short', 'Detailed']} />}
    >
      <SemanticZoomList
        controller={zoom}
        keyboardShortcuts="global"
        className="absolute inset-0"
        contentClassName="px-2 pt-2 pb-4"
        itemCount={threads.length}
        renderItem={(i) => {
          const [from, time] = threads[i]
          return (
            <div className={`${ROW} flex gap-3 px-3 py-3`} onClick={tapToExpand(zoom, i)}>
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--social-muted)] text-[15px] font-semibold">
                {from[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{from}</span>
                  <span className="shrink-0 text-[12px] text-[var(--social-fg-subtle)]">{time}</span>
                </div>
                <LazyLeveledTextView
                  loader={loaders[i]}
                  itemId={i}
                  className="text-[15px] leading-[1.45] text-[var(--social-fg-muted)]"
                  renderLoading={() => (
                    <div
                      className="mt-2 h-0.5 animate-pulse rounded-full bg-[var(--social-fg-subtle)]"
                      role="progressbar"
                      aria-label="正在生成摘要"
                    />
                  )}
                  renderError={(_, retry) => (
                    <button
                      type="button"
                      className="social-pressable mt-1 min-h-11 rounded-full px-4 text-[15px] font-semibold"
                      onClick={retry}
                    >
                      Retry
                    </button>
                  )}
                />
              </div>
            </div>
          )
        }}
      />
    </Screen>
  )
}

// ───────────────────────────── Reads: expandable ─────────────────────────────

function ReadsDemo({ action }: { action: ReactNode }) {
  return (
    <Screen title="Reads" subtitle="Tap an article or Show more. No controller needed." action={action}>
      <div className="absolute inset-0 space-y-3 overflow-y-auto px-4 pt-3 pb-4">
        {articles.map(([title, text], i) => (
          <article key={i} className="social-card rounded-2xl px-4 pt-4 pb-1">
            <h2 className="text-[16px] font-semibold">{title}</h2>
            <div className="h-2" />
            <ExpandableLeveledText
              text={text}
              textClassName="text-[15px] leading-[1.5]"
              onLinkTap={openLink}
              footer={({ level, maxLevel, toggle }) => (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="social-pressable min-h-11 rounded-full px-4 text-[15px] font-semibold active:scale-[.98]"
                    onClick={toggle}
                  >
                    {level < maxLevel ? 'Show more' : 'Show less'}
                  </button>
                </div>
              )}
            />
          </article>
        ))}
      </div>
    </Screen>
  )
}

// ───────────────────────────── 240 items ─────────────────────────────

const perfItems = Array.from({ length: 240 }, (_, i) => {
  const src = i % 2 === 0 ? chatTexts[(i / 2) % chatTexts.length] : trip[((i - 1) / 2) % trip.length][2]
  return { id: i, text: src }
})

function PerfDemo({ action }: { action: ReactNode }) {
  const labels = ['结论', '摘要', '全部']
  const zoom = useSemanticZoomController({ levelLabels: labels })
  useExpose('perf', zoom)
  return (
    <Screen title="240 条" subtitle="中英混排长列表，用来测捏合时的帧耗时" action={action} footer={<Levels controller={zoom} labels={labels} />}>
      <SemanticZoomList
        controller={zoom}
        keyboardShortcuts="global"
        className="absolute inset-0"
        contentClassName="px-2 pt-1 pb-4"
        itemCount={perfItems.length}
        renderItem={(i) => (
          <div className={`${ROW} px-3 py-3`} onClick={tapToExpand(zoom, i)}>
            <div className="text-[12px] text-[var(--social-fg-subtle)]">#{i + 1}</div>
            <LeveledTextView text={perfItems[i].text} itemId={i} className="text-[15px] leading-[1.5]" />
          </div>
        )}
      />
    </Screen>
  )
}
