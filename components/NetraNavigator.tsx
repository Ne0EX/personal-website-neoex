'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { animate, createScope } from 'animejs'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import {
  netraToolView,
  plainNetraText,
  readStoredNetraHistory,
  storedHistoryToUIMessages,
  uiMessageText,
  uiMessagesToStoredHistory,
  userMessagesForRequest,
} from '@/lib/netra/ui-message'
import './NetraNavigator.css'

type Lang = 'en' | 'th'
type NetraError = { code: string; message: string }
type HistoryScope = 'public' | 'owner'
type NetraUiState = 'ready' | 'open' | 'busy'
type NetraCopy = {
  open: string; close: string; title: string; attached: string
  readyState: string; openState: string; busyState: string
  idle: string; survey: string; placeholder: string; send: string
  offline: string; rateLimited: string; invalidRequest: string
  quota: string; empty: string; question: string; response: string
  transcript: string; transmission: string; clear: string; cleared: string
  responseReady: string; live: string; signal: string
  surveyingTool: string; resolvedTool: string; unresolvedTool: string; traces: string
}

const HISTORY_KEYS = {
  public: 'wl-netra-history:public',
  owner: 'wl-netra-history:owner',
} as const

const copy: Record<Lang, NetraCopy> = {
  en: {
    open: 'open NETRA navigator', close: 'close NETRA navigator',
    title: 'NETRA · NAVIGATOR', attached: 'ATTACHED PROBE · α—04',
    readyState: 'NAVIGATOR READY', openState: 'CHANNEL OPEN', busyState: 'SURVEYING',
    idle: 'standing by · archive in view', survey: 'surveying archive ·─────',
    placeholder: 'ask the archive', send: 'transmit',
    offline: 'signal lost · α holding · try again',
    rateLimited: 'daily ceiling reached · channel closed',
    invalidRequest: 'transmission rejected · check the query', quota: 'quota remaining',
    empty: 'the archive is quiet here. transmit a question to begin the survey.',
    question: 'query', response: 'trace', transcript: 'FIELD TRANSCRIPT',
    transmission: 'TRANSMISSION', clear: 'CLEAR LOG', cleared: 'local history cleared',
    responseReady: 'NETRA response received', live: 'LIVE', signal: 'SIGNAL',
    surveyingTool: 'surveying', resolvedTool: 'resolved', unresolvedTool: 'unresolved', traces: 'traces',
  },
  th: {
    open: 'เปิดเครื่องนำทาง NETRA', close: 'ปิดเครื่องนำทาง NETRA',
    title: 'NETRA · เครื่องนำทาง', attached: 'โพรบเชื่อมต่อ · α—04',
    readyState: 'เครื่องนำทางพร้อม', openState: 'ช่องสัญญาณเปิด', busyState: 'กำลังสำรวจ',
    idle: 'เตรียมพร้อม · มองเห็นคลังแล้ว', survey: 'กำลังสำรวจคลัง ·─────',
    placeholder: 'ถามคลังข้อมูล', send: 'ส่งสัญญาณ',
    offline: 'สัญญาณขาดหาย · α คงที่ · ลองอีกครั้ง',
    rateLimited: 'ถึงเพดานประจำวัน · ปิดช่องสัญญาณ',
    invalidRequest: 'รูปแบบการส่งสัญญาณไม่ถูกต้อง · ตรวจสอบคำถาม', quota: 'โควตาคงเหลือ',
    empty: 'คลังข้อมูลยังเงียบอยู่ที่นี่ ส่งคำถามเพื่อเริ่มการสำรวจ',
    question: 'คำถาม', response: 'ร่องรอย', transcript: 'บันทึกภาคสนาม',
    transmission: 'การส่งสัญญาณ', clear: 'ล้างบันทึก', cleared: 'ล้างประวัติในเครื่องแล้ว',
    responseReady: 'ได้รับคำตอบจาก NETRA แล้ว', live: 'กำลังรับ', signal: 'สัญญาณ',
    surveyingTool: 'กำลังสำรวจ', resolvedTool: 'สำรวจแล้ว', unresolvedTool: 'ไม่พบสัญญาณ', traces: 'ร่องรอย',
  },
}

function errorCodeFrom(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const nested = record.error
  const candidate = nested && typeof nested === 'object'
    ? (nested as Record<string, unknown>).code
    : record.code
  if (typeof candidate !== 'string') return null
  const normalized = candidate.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40)
  return normalized || null
}

async function readHttpError(response: Response, t: NetraCopy): Promise<NetraError> {
  let payload: unknown
  try {
    const body = await response.text()
    payload = body ? JSON.parse(body) : null
  } catch {
    payload = null
  }
  const code = errorCodeFrom(payload) ?? 'HTTP_' + response.status
  if (code === 'RATE_LIMITED' || response.status === 429) return { code, message: t.rateLimited }
  if (code === 'INVALID_BODY' || response.status === 400 || response.status === 422) {
    return { code, message: t.invalidRequest }
  }
  return { code, message: t.offline }
}

function thrownNetraError(error: unknown, t: NetraCopy): NetraError {
  const code = errorCodeFrom(error)
  if (code && error instanceof Error && error.message) return { code, message: error.message }
  return { code: code ?? 'NETWORK_UNAVAILABLE', message: t.offline }
}

function NetraToolStatus({ part, t }: {
  part: UIMessage['parts'][number]
  t: NetraCopy
}) {
  const view = netraToolView(part)
  if (!view) return null
  const failed = view.state === 'output-error' || view.state === 'output-denied'
  const resolved = view.state === 'output-available'
  const phase = failed ? t.unresolvedTool : resolved ? t.resolvedTool : t.surveyingTool
  const state = failed ? 'error' : resolved ? 'resolved' : 'surveying'

  return <div className="netra-tool" data-state={state}>
    <p className="netra-tool-status">
      <span aria-hidden="true">{resolved ? '◇' : failed ? '△' : '◆'}</span>
      NETRA · {phase}: {view.name.replaceAll('_', ' ')}
      {resolved ? ` · ${view.traces.length} ${t.traces}` : ''}
    </p>
    {view.traces.length > 0 && <ul className="netra-tool-traces">
      {view.traces.map((trace) => <li key={`${view.id}-${trace.permalink}`}>
        <a href={trace.permalink}>{trace.title}<span aria-hidden="true"> ↗</span></a>
      </li>)}
    </ul>}
  </div>
}

function NetraReticle() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" />
    <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1" />
    <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1" />
    <line x1="12" y1="15" x2="12" y2="21" stroke="currentColor" strokeWidth="1" />
    <line x1="3" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1" />
    <line x1="15" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1" />
  </svg>
}

function NetraTriggerReticle() {
  return <svg
    className="netra-trigger-mark"
    width="32"
    height="32"
    viewBox="0 0 32 32"
    fill="none"
    focusable="false"
    aria-hidden="true"
  >
    <g className="netra-trigger-probe">
      <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      <g className="netra-trigger-axes">
        <line x1="16" y1="1.5" x2="16" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
        <line x1="25.5" y1="16" x2="30.5" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
        <line x1="16" y1="25.5" x2="16" y2="30.5" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
        <line x1="1.5" y1="16" x2="6.5" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      </g>
    </g>
    <g className="netra-trigger-brackets">
      <path d="M13 10.5H10.5V13" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      <path d="M19 10.5H21.5V13" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      <path d="M21.5 19V21.5H19" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
      <path d="M13 21.5H10.5V19" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
    </g>
    <g className="netra-trigger-acquired-arc">
      <circle cx="16" cy="16" r="10.5" transform="rotate(-90 16 16)" stroke="currentColor" strokeWidth="1" strokeDasharray="13.2 52.8" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
    </g>
    <g className="netra-trigger-busy-scan">
      <circle cx="16" cy="16" r="10.5" transform="rotate(-90 16 16)" stroke="currentColor" strokeWidth="1" strokeDasharray="8.25 24.74 8.25 24.74" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
    </g>
    <circle className="netra-trigger-core" cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
  </svg>
}

export function NetraNavigator({ lang }: { lang: string }) {
  const pathname = usePathname()
  const locale: Lang = lang === 'th' ? 'th' : 'en'
  const t = copy[locale]
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [problem, setProblem] = useState<NetraError | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [historyScope, setHistoryScope] = useState<HistoryScope | null>(null)
  const [historyReady, setHistoryReady] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const mountedRef = useRef(true)
  const motionScopeRef = useRef<ReturnType<typeof createScope> | null>(null)
  const mountMotionHandledRef = useRef(false)
  const previousMotionStateRef = useRef<NetraUiState>('ready')
  const [requestContext] = useState(() => ({ locale, pathname, t }))
  const [transport] = useState(() => new DefaultChatTransport<UIMessage>({
    api: '/api/chat',
    credentials: 'same-origin',
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        messages: userMessagesForRequest(messages),
        served_lang: requestContext.locale,
        page: { pathname: requestContext.pathname },
      },
    }),
    fetch: async (input, init) => {
      const response = await fetch(input, init)
      const header = response.headers.get('X-NETRA-Remaining')
      if (header !== null) {
        const value = Number(header)
        if (Number.isInteger(value) && value >= 0) setRemaining(value)
      }
      if (!response.ok) {
        const problem = await readHttpError(response, requestContext.t)
        throw Object.assign(new Error(problem.message), { code: problem.code })
      }
      return response
    },
  }))
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    clearError,
  } = useChat({
    transport,
    experimental_throttle: 40,
    onError: (error) => {
      if (!mountedRef.current) return
      setProblem(thrownNetraError(error, requestContext.t))
    },
    onFinish: ({ isAbort, isError }) => {
      if (!mountedRef.current || isAbort || isError) return
      setAnnouncement(requestContext.t.responseReady)
    },
  })
  const busy = status === 'submitted' || status === 'streaming'
  const state: NetraUiState = busy ? 'busy' : open ? 'open' : 'ready'
  const stateLabel = busy ? t.busyState : open ? t.openState : t.readyState

  useEffect(() => {
    Object.assign(requestContext, { locale, pathname, t })
  }, [locale, pathname, requestContext, t])

  useEffect(() => {
    const root = triggerRef.current
    if (!root) return

    const motion = createScope({
      root,
      mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' },
    })
    motionScopeRef.current = motion

    motion.add((scope) => {
      if (!scope) return

      let mountAnimations: ReturnType<typeof animate>[] = []
      let interactionAnimations: ReturnType<typeof animate>[] = []
      let stateAnimations: ReturnType<typeof animate>[] = []

      const revertAnimations = (animations: ReturnType<typeof animate>[]) => {
        for (let index = animations.length - 1; index >= 0; index -= 1) {
          animations[index].revert()
        }
        animations.length = 0
      }

      const clearMount = () => revertAnimations(mountAnimations)
      const replaceInteraction = (next: () => ReturnType<typeof animate>[]) => {
        revertAnimations(interactionAnimations)
        interactionAnimations = next()
      }
      const replaceState = (next: () => ReturnType<typeof animate>[]) => {
        revertAnimations(stateAnimations)
        stateAnimations = next()
      }

      // The component-lifetime guard prevents React development replays. Marking
      // reduced-motion mounts handled also prevents a delayed animation on opt-out.
      if (!mountMotionHandledRef.current) {
        mountMotionHandledRef.current = true
        if (!scope.matches.reduceMotion) {
          mountAnimations = [
            animate('.netra-trigger-acquired-arc', {
              opacity: [0, 0.85, 0],
              rotate: ['-70deg', '0deg'],
              duration: 460,
              ease: 'outQuart',
            }),
            animate('.netra-trigger-brackets', {
              opacity: [0, 0.65, 0],
              scale: [0.86, 1],
              delay: 50,
              duration: 360,
              ease: 'outQuart',
            }),
            animate('.netra-trigger-core', {
              opacity: [0.45, 1],
              scale: [0.7, 1],
              delay: 150,
              duration: 240,
              ease: 'outExpo',
            }),
          ]
        }
      }

      const lockOn = () => {
        if (root.dataset.state !== 'ready' || scope.matches.reduceMotion) return
        clearMount()
        replaceInteraction(() => [
          animate('.netra-trigger-brackets', {
            opacity: [0, 0.72],
            scale: [1.12, 1],
            duration: 180,
            ease: 'outQuart',
          }),
          animate('.netra-trigger-acquired-arc', {
            opacity: [0, 0.55],
            rotate: ['-18deg', '0deg'],
            duration: 180,
            ease: 'outQuart',
          }),
          animate('.netra-trigger-axes', {
            scale: [1, 0.9],
            duration: 180,
            ease: 'outQuart',
          }),
        ])
      }

      const releaseLock = () => {
        if (root.dataset.state !== 'ready') return
        if (root.matches(':hover') || root.matches(':focus-visible')) return
        clearMount()
        if (scope.matches.reduceMotion) return
        replaceInteraction(() => [
          animate('.netra-trigger-brackets', {
            opacity: [0.72, 0],
            scale: 1,
            duration: 140,
            ease: 'outQuart',
          }),
          animate('.netra-trigger-acquired-arc', {
            opacity: [0.55, 0],
            rotate: '0deg',
            duration: 140,
            ease: 'outQuart',
          }),
          animate('.netra-trigger-axes', {
            scale: 1,
            duration: 140,
            ease: 'outQuart',
          }),
        ])
      }

      const press = () => {
        if (root.dataset.state !== 'ready' || scope.matches.reduceMotion) return
        clearMount()
        replaceInteraction(() => [animate('.netra-trigger-mark', {
          scale: [1, 0.94],
          duration: 80,
          ease: 'outQuad',
        })])
      }

      const settle = () => {
        if (root.matches(':hover') || root.matches(':focus-visible')) lockOn()
        else releaseLock()
      }

      const transitionState = (next: NetraUiState, previous: NetraUiState) => {
        if (next === 'ready' && previous === 'ready') return

        clearMount()
        revertAnimations(interactionAnimations)
        revertAnimations(stateAnimations)
        if (scope.matches.reduceMotion) return

        if (next === 'busy') {
          replaceState(() => [
            animate('.netra-trigger-busy-scan', {
              rotate: ['0deg', '360deg'],
              duration: 1000,
              ease: 'linear',
              loop: true,
            }),
            animate('.netra-trigger-core', {
              opacity: [0.5, 1, 0.5],
              duration: 1000,
              ease: 'inOutSine',
              loop: true,
            }),
          ])
          return
        }

        if (next === 'open') {
          replaceState(() => [
            animate('.netra-trigger-brackets', {
              opacity: [0, 1],
              scale: [0.86, 1],
              duration: 240,
              ease: 'outExpo',
            }),
            animate('.netra-trigger-acquired-arc', {
              opacity: [0, 1],
              rotate: ['-18deg', '0deg'],
              duration: 240,
              ease: 'outExpo',
            }),
            animate('.netra-trigger-core', {
              opacity: [0.45, 1],
              scale: [0.7, 1],
              duration: 240,
              ease: 'outExpo',
            }),
            animate('.netra-trigger-mark', {
              scale: 1,
              duration: 240,
              ease: 'outExpo',
            }),
          ])
          return
        }

        replaceState(() => [
          animate('.netra-trigger-brackets', {
            opacity: [1, 0],
            duration: 180,
            ease: 'outQuart',
          }),
          animate('.netra-trigger-acquired-arc, .netra-trigger-busy-scan', {
            opacity: [1, 0],
            rotate: '0deg',
            duration: 180,
            ease: 'outQuart',
          }),
          animate('.netra-trigger-core', {
            opacity: [0.5, 1],
            scale: 1,
            duration: 180,
            ease: 'outQuart',
          }),
        ])
      }

      scope.add('lockOn', lockOn)
      scope.add('releaseLock', releaseLock)
      scope.add('press', press)
      scope.add('settle', settle)
      scope.add('transitionState', transitionState)

      const onPointerEnter = () => scope.methods.lockOn()
      const onPointerLeave = () => scope.methods.releaseLock()
      const onFocus = () => {
        if (root.matches(':focus-visible')) scope.methods.lockOn()
      }
      const onBlur = () => scope.methods.releaseLock()
      const onPointerDown = () => scope.methods.press()
      const onPointerUp = () => scope.methods.settle()
      const onKeyDown = (event: KeyboardEvent) => {
        if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) scope.methods.press()
      }
      const onKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') scope.methods.settle()
      }

      root.addEventListener('pointerenter', onPointerEnter)
      root.addEventListener('pointerleave', onPointerLeave)
      root.addEventListener('focus', onFocus)
      root.addEventListener('blur', onBlur)
      root.addEventListener('pointerdown', onPointerDown)
      root.addEventListener('pointerup', onPointerUp)
      root.addEventListener('pointercancel', onPointerUp)
      root.addEventListener('keydown', onKeyDown)
      root.addEventListener('keyup', onKeyUp)

      if (root.dataset.state === 'busy' && !scope.matches.reduceMotion) {
        transitionState('busy', 'open')
      }

      return () => {
        root.removeEventListener('pointerenter', onPointerEnter)
        root.removeEventListener('pointerleave', onPointerLeave)
        root.removeEventListener('focus', onFocus)
        root.removeEventListener('blur', onBlur)
        root.removeEventListener('pointerdown', onPointerDown)
        root.removeEventListener('pointerup', onPointerUp)
        root.removeEventListener('pointercancel', onPointerUp)
        root.removeEventListener('keydown', onKeyDown)
        root.removeEventListener('keyup', onKeyUp)
      }
    })

    return () => {
      motion.revert()
      if (motionScopeRef.current === motion) motionScopeRef.current = null
    }
  }, [])

  useEffect(() => {
    const previous = previousMotionStateRef.current
    motionScopeRef.current?.methods.transitionState?.(state, previous)
    previousMotionStateRef.current = state
  }, [state])

  useEffect(() => {
    const controller = new AbortController()

    async function hydrateScopedHistory() {
      let scope: HistoryScope = 'public'
      try {
        const response = await fetch('/api/console/auth-probe', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (response.ok) scope = 'owner'
      } catch {
        // Network/auth uncertainty fails closed into public history.
      }

      let saved: string | null = null
      try {
        // Never migrate the legacy auth-agnostic transcript: it may contain a
        // prior owner-only answer from this browser profile.
        localStorage.removeItem('wl-netra-history')
        saved = localStorage.getItem(HISTORY_KEYS[scope])
      } catch {
        // Storage can be unavailable; the in-memory navigator still works.
      }

      if (!mountedRef.current || controller.signal.aborted) return
      setHistoryScope(scope)
      setMessages(storedHistoryToUIMessages(readStoredNetraHistory(saved), scope))
      setHistoryReady(true)
    }

    void hydrateScopedHistory()
    return () => controller.abort()
  }, [setMessages])

  useEffect(() => {
    if (!historyReady || !historyScope || status === 'submitted' || status === 'streaming') return
    try {
      const storedMessages = uiMessagesToStoredHistory(messages)
      if (storedMessages.length) localStorage.setItem(HISTORY_KEYS[historyScope], JSON.stringify(storedMessages))
      else localStorage.removeItem(HISTORY_KEYS[historyScope])
    } catch {
      // The navigator remains usable when storage is unavailable or full.
    }
  }, [historyReady, historyScope, messages, status])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      void stop()
    }
  }, [stop])

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus()
      wasOpenRef.current = false
      return
    }
    wasOpenRef.current = true
    const panel = panelRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => {
      const initial = panel?.querySelector<HTMLElement>('[data-netra-initial-focus]:not([disabled])')
        ?? panel?.querySelector<HTMLElement>('button:not([disabled])')
      initial?.focus()
    })
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    panel?.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      panel?.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (open) transcriptEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy || !historyReady) return
    setInput('')
    setProblem(null)
    clearError()
    setAnnouncement(t.survey)
    await sendMessage({ text })
  }

  function clearHistory() {
    setMessages([])
    setProblem(null)
    clearError()
    setAnnouncement(t.cleared)
    try {
      if (historyScope) localStorage.removeItem(HISTORY_KEYS[historyScope])
    } catch { /* state still clears */ }
    inputRef.current?.focus()
  }

  return <>
    <button
      ref={triggerRef}
      className="netra-trigger atlas-netra"
      type="button"
      lang={locale}
      data-state={state}
      aria-label={(open ? t.close : t.open) + ' · ' + stateLabel}
      aria-controls="netra-navigator-panel"
      aria-expanded={open}
      aria-busy={busy}
      aria-haspopup="dialog"
      onClick={() => setOpen((current) => !current)}
    >
      <span className="reticle netra-trigger-reticle"><NetraTriggerReticle /></span>
      <span className="netra-trigger-tooltip" aria-hidden="true">NETRA</span>
    </button>

    {open && <div className="netra-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false)
    }}>
      <section
        id="netra-navigator-panel"
        ref={panelRef}
        className="netra-panel paper-canvas"
        role="dialog"
        aria-modal="true"
        aria-labelledby="netra-title"
        aria-describedby="netra-connection"
        lang={locale}
        data-state={busy ? 'busy' : 'open'}
        tabIndex={-1}
      >
        <span className="corner-marks netra-panel-corners" aria-hidden="true" />
        <header className="netra-header">
          <div className="netra-header-instrument atlas-netra">
            <span className="reticle netra-reticle"><NetraReticle /></span>
            <span className="id-box netra-identity">
              <span className="lab netra-kicker">{t.attached}</span>
              <h2 id="netra-title" className="tgt">{t.title}</h2>
            </span>
            <span className="readout" aria-hidden="true">
              <span>PROBE</span><b>α—04</b>
            </span>
          </div>
          <div className="netra-header-actions">
            <button type="button" className="netra-clear" aria-controls="netra-transcript" disabled={busy || !messages.length} onClick={clearHistory}>
              <span aria-hidden="true">∅</span> {t.clear}
            </button>
            <button type="button" className="netra-close" aria-label={t.close} onClick={() => setOpen(false)}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>
        <div id="netra-connection" className="netra-connection">
          <b>{busy ? t.busyState : t.openState}</b>
          <span className="netra-quota">{remaining !== null ? t.quota + ' · ' + remaining : 'WORLDLINE // NETRA'}</span>
        </div>
        <div className="netra-seam" aria-hidden="true"><span /> {t.transcript} <span /></div>
        <div id="netra-transcript" className="netra-transcript" role="log" aria-label={t.transcript} aria-busy={busy}>
          <p className="netra-status"><span aria-hidden="true">◆</span> NETRA · {busy ? t.survey : t.idle}</p>
          {!messages.length && !busy && !problem && <p className="netra-empty"><span aria-hidden="true">∇</span>{t.empty}</p>}
          {messages.map((message, index) => {
            if (message.role !== 'user' && message.role !== 'assistant') return null
            return <div
              key={message.id}
              className={'netra-record netra-record-' + message.role
                + (message.role === 'assistant' ? ' atlas-netra-voice' : '')}
            >
              <p className={'netra-record-label' + (message.role === 'assistant' ? ' voice-tag' : '')}>
                {message.role === 'user' ? t.question : t.response} · {String(index + 1).padStart(2, '0')}
              </p>
              {message.role === 'user'
                ? <p className="netra-user">{uiMessageText(message)}</p>
                : message.parts.map((part, partIndex) => part.type === 'text'
                  ? <p key={`text-${partIndex}`} className="netra-message voice-body">{plainNetraText(part.text)}</p>
                  : <NetraToolStatus key={`part-${partIndex}`} part={part} t={t} />)}
            </div>
          })}
          {busy && messages.at(-1)?.role !== 'assistant' && <div className="netra-record netra-record-assistant atlas-netra-voice" aria-live="off">
            <p className="netra-record-label voice-tag">{t.response} · {t.live}</p>
            <p className="netra-message voice-body">···</p>
          </div>}
          {problem && <div className="netra-error" role="alert" aria-live="assertive">
            <p className="netra-error-code"><span aria-hidden="true">△</span> {t.signal} · {problem.code}</p>
            <p>{problem.message}</p>
          </div>}
          <div ref={transcriptEndRef} aria-hidden="true" />
        </div>
        <form className="netra-composer" onSubmit={submit}>
          <label className="netra-composer-label" htmlFor="netra-query">{t.transmission}</label>
          <div className="netra-composer-row">
            <input
              ref={inputRef}
              id="netra-query"
              data-netra-initial-focus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t.placeholder}
              disabled={busy || !historyReady}
              maxLength={8_000}
              autoComplete="off"
            />
            <button type="submit" disabled={busy || !historyReady || !input.trim()}><span aria-hidden="true">⟶</span> {t.send}</button>
          </div>
        </form>
        <footer className="netra-footer"><span>{t.attached}</span><span>WORLDLINE // NETRA</span></footer>
        <p className="netra-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      </section>
    </div>}
  </>
}
