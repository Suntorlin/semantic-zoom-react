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
import { articles, threads, trip, visits } from './data/original'

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

const TABS = [
  { id: 'chat', label: 'AI 对话', icon: '💬' },
  { id: 'travel', label: 'Travel', icon: '🗺️' },
  { id: 'health', label: 'Health', icon: '🩺' },
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'reads', label: 'Reads', icon: '📰' },
  { id: 'perf', label: '240 条', icon: '⚡' },
] as const
type TabId = (typeof TABS)[number]['id']

const tabFromHash = (): TabId => {
  const h = location.hash.slice(1)
  return (TABS.find((t) => t.id === h)?.id ?? 'chat') as TabId
}

export function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash)
  useEffect(() => {
    const on = () => setTab(tabFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col">
      <main className="relative min-h-0 flex-1">
        {tab === 'chat' && <ChatDemo />}
        {tab === 'travel' && <TravelDemo />}
        {tab === 'health' && <HealthDemo />}
        {tab === 'inbox' && <InboxDemo />}
        {tab === 'reads' && <ReadsDemo />}
        {tab === 'perf' && <PerfDemo />}
      </main>
      <nav className="grid shrink-0 grid-cols-6 border-t border-slate-200 bg-slate-100 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-600 aria-[current=page]:font-semibold aria-[current=page]:text-sky-800"
          >
            <span aria-hidden className="text-lg leading-none">
              {t.icon}
            </span>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  )
}

// ───────────────────────────── shared ─────────────────────────────

function Screen({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-2xl font-normal text-slate-900">{title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
      {footer}
    </div>
  )
}

function Levels({ controller, labels }: { controller: SemanticZoomController; labels: string[] }) {
  return (
    <div className="shrink-0 p-3">
      <LevelSwitcher
        controller={controller}
        labels={labels}
        label="详细程度"
        className="grid auto-cols-fr grid-flow-col overflow-hidden rounded-full border border-slate-500"
        buttonClassName="border-l border-slate-500 py-2.5 text-sm text-slate-800 first:border-l-0 data-[active]:bg-sky-100 data-[active]:text-sky-900 focus-visible:outline-2 focus-visible:outline-sky-600"
      />
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
  el.className = 'fixed inset-x-4 bottom-24 z-50 rounded-md bg-slate-800 px-4 py-3 text-sm text-white shadow-lg'
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 1800)
}

// ───────────────────────────── AI chat ─────────────────────────────

const chatTexts = aiChat.map((t) => LeveledText.fromVersions(t.reply))
// Item 0 is the newest message (drawn at the bottom).
const chatItems = aiChat
  .flatMap((t, i) => [
    { kind: 'user' as const, text: t.user, time: t.time, id: `u${i}` },
    { kind: 'ai' as const, text: chatTexts[i], time: t.time, id: `a${i}` },
  ])
  .reverse()

function ChatDemo() {
  const zoom = useSemanticZoomController({ levelLabels: ['只看结论', '看摘要', '看全部步骤'] })
  useExpose('chat', zoom)
  return (
    <Screen
      title="AI 对话"
      subtitle="最新在底部。双指捏合切换详细程度，或点一条只展开这一条。"
      footer={<Levels controller={zoom} labels={['只看结论', '看摘要', '看全部步骤']} />}
    >
      <SemanticZoomList
        controller={zoom}
        reverse
        keyboardShortcuts="global"
        className="absolute inset-0 px-3 py-2"
        itemCount={chatItems.length}
        getItemKey={(i) => chatItems[i].id}
        itemClassName="py-1"
        renderItem={(i) => {
          const m = chatItems[i]
          if (m.kind === 'user') {
            return (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-sky-100 px-3.5 py-2 text-[15px] leading-[1.45] text-sky-950">
                  {m.text}
                  <div className="mt-0.5 text-right text-[11px] text-sky-900/60">{m.time}</div>
                </div>
              </div>
            )
          }
          return (
            <div className="flex justify-start">
              <div
                className="max-w-[88%] cursor-pointer rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[15px] leading-[1.5] text-slate-900 shadow-sm ring-1 ring-slate-200"
                onClick={tapToExpand(zoom, m.id)}
                data-testid={`reply-${m.id}`}
              >
                <LeveledTextView text={m.text} itemId={m.id} />
                <div className="mt-1 text-[11px] text-slate-400">{m.time}</div>
              </div>
            </div>
          )
        }}
      />
    </Screen>
  )
}

// ───────────────────────────── Travel (same as the original) ─────────────────────────────

function TravelDemo() {
  const zoom = useSemanticZoomController({ levelLabels: ['Highlights', 'Day summary', 'Full entry'] })
  useExpose('travel', zoom)
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <SemanticZoomList
          controller={zoom}
          keyboardShortcuts="global"
          className="absolute inset-0"
          contentClassName="px-4 pt-3 pb-8"
          header={
            <div className="flex h-[180px] flex-col justify-end rounded-[22px] bg-[linear-gradient(to_bottom_left,#F4C27A,#3F8FA8,#123E57)] p-[18px]">
              <div className="text-[28px] font-bold text-white">Lisbon &amp; Porto</div>
              <div className="mt-1 text-sm text-white/70">Pinch the list, or tap one day</div>
            </div>
          }
          itemCount={trip.length}
          renderItem={(i) => {
            const [date, place, text] = trip[i]
            return (
              <div className="cursor-pointer py-[11px] active:bg-slate-200/50" onClick={tapToExpand(zoom, i)}>
                <div className="text-sm">
                  <span className="font-semibold">{date}</span>
                  <span className="text-slate-500">{`  ·  ${place}`}</span>
                </div>
                <div className="h-1.5" />
                <LeveledTextView text={text} itemId={i} onLinkTap={openLink} className="text-base leading-[1.4]" />
              </div>
            )
          }}
        />
      </div>
      <Levels controller={zoom} labels={['Highlights', 'Summary', 'Full']} />
    </div>
  )
}

// ───────────────────────────── Health: grid ─────────────────────────────

function HealthDemo() {
  const zoom = useSemanticZoomController({ levelLabels: ['Visit titles', 'Visit summaries', 'Clinician notes'] })
  useExpose('health', zoom)
  return (
    <Screen
      title="Patient timeline"
      subtitle="Visit title › summary › clinician notes"
      footer={<Levels controller={zoom} labels={['Titles', 'Summary', 'Notes']} />}
    >
      <SemanticZoomGrid
        controller={zoom}
        keyboardShortcuts="global"
        className="absolute inset-0"
        contentClassName="px-4 pb-4"
        maxColumnWidth={380}
        gap={12}
        itemCount={visits.length}
        renderItem={(i) => {
          const [date, dept, text] = visits[i]
          return (
            <div className="cursor-pointer rounded-xl border border-slate-300 bg-white p-4" onClick={tapToExpand(zoom, i)}>
              <div className="text-sm font-medium">{`${date} · ${dept}`}</div>
              <div className="h-2" />
              <LeveledTextView text={text} itemId={i} className="text-base leading-normal" />
            </div>
          )
        }}
      />
    </Screen>
  )
}

// ───────────────────────────── Inbox: load on demand ─────────────────────────────

const fakeLlm = (summaries: string[]) => new Promise<string[]>((r) => setTimeout(() => r(summaries), 900))

function InboxDemo() {
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
      footer={<Levels controller={zoom} labels={['Subject', 'Short', 'Detailed']} />}
    >
      <SemanticZoomList
        controller={zoom}
        keyboardShortcuts="global"
        className="absolute inset-0"
        contentClassName="px-2 pb-4"
        itemCount={threads.length}
        renderItem={(i) => {
          const [from, time] = threads[i]
          return (
            <div className="flex cursor-pointer gap-3 px-2 py-3" onClick={tapToExpand(zoom, i)}>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-900">{from[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex text-sm font-medium">
                  <span className="flex-1">{from}</span>
                  <span className="text-[11px] font-normal text-slate-500">{time}</span>
                </div>
                <div className="h-1" />
                <LazyLeveledTextView
                  loader={loaders[i]}
                  itemId={i}
                  className="text-sm leading-[1.35]"
                  renderLoading={() => (
                    <div className="mt-1.5 h-0.5 overflow-hidden rounded bg-sky-100" role="progressbar" aria-label="正在生成摘要">
                      <div className="h-full w-1/3 animate-[sz-indeterminate_1s_ease-in-out_infinite] bg-sky-600" />
                    </div>
                  )}
                  renderError={(_, retry) => (
                    <button type="button" className="mt-1 text-sm text-sky-800 underline" onClick={retry}>
                      Retry
                    </button>
                  )}
                />
              </div>
            </div>
          )
        }}
      />
      <style>{'@keyframes sz-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
    </Screen>
  )
}

// ───────────────────────────── Reads: expandable ─────────────────────────────

function ReadsDemo() {
  return (
    <Screen title="Reads" subtitle="Tap an article or use Show more. No controller needed.">
      <div className="absolute inset-0 space-y-3 overflow-y-auto px-4 pb-4">
        {articles.map(([title, text], i) => (
          <article key={i} className="rounded-xl border border-slate-300 bg-white px-4 pt-4 pb-1">
            <h2 className="text-base font-medium">{title}</h2>
            <div className="h-2" />
            <ExpandableLeveledText
              text={text}
              textClassName="text-base leading-[1.4]"
              onLinkTap={openLink}
              footer={({ level, maxLevel, toggle }) => (
                <div className="flex justify-end">
                  <button type="button" className="px-3 py-2 text-sm text-sky-800" onClick={toggle}>
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

function PerfDemo() {
  const zoom = useSemanticZoomController({ levelLabels: ['结论', '摘要', '全部'] })
  useExpose('perf', zoom)
  return (
    <Screen title="240 条" subtitle="中英混排长列表，用来测捏合时的帧耗时。" footer={<Levels controller={zoom} labels={['结论', '摘要', '全部']} />}>
      <SemanticZoomList
        controller={zoom}
        keyboardShortcuts="global"
        className="absolute inset-0"
        contentClassName="px-4 pb-4"
        itemCount={perfItems.length}
        renderItem={(i) => (
          <div className="cursor-pointer border-b border-slate-200 py-2.5" onClick={tapToExpand(zoom, i)}>
            <div className="text-xs text-slate-500">#{i + 1}</div>
            <LeveledTextView text={perfItems[i].text} itemId={i} className="text-[15px] leading-[1.45]" />
          </div>
        )}
      />
    </Screen>
  )
}
