'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { animate, createScope } from 'animejs'
import './NetraNavigator.css'

type Lang = 'en' | 'th'
type Message = { role: 'user' | 'assistant'; content: string }
type NetraError = { code: string; message: string }
type NetraUiState = 'ready' | 'open' | 'busy'
type NetraCopy = {
  open: string; close: string; title: string; attached: string
  readyState: string; openState: string; busyState: string
  idle: string; survey: string; placeholder: string; send: string
  offline: string; rateLimited: string; invalidRequest: string
  quota: string; empty: string; question: string; response: string
  transcript: string; transmission: string; clear: string; cleared: string
  responseReady: string; live: string; signal: string
}

const copy: Record<Lang, NetraCopy> = {
  en: {
    open: 'open NETRA navigator', close: 'close NETRA navigator',
    title: 'NETRA · NAVIGATOR', attached: 'ATTACHED PROBE · α—04',
    readyState: 'NAVIGATOR READY', openState: 'CHANNEL OPEN', busyState: 'SURVEYING',
    idle: 'standing by · archive in view', survey: 'surveying archive ·─────',
    placeholder: 'ask the archive', send: 'transmit',
    offline: 'signal lost · α holding · try again',
    rateLimited: 'i need to step away from the instrument for the day. α drift has hit the ceiling.',
    invalidRequest: 'transmission rejected · check the query', quota: 'quota remaining',
    empty: 'the archive is quiet here. transmit a question to begin the survey.',
    question: 'query', response: 'trace', transcript: 'FIELD TRANSCRIPT',
    transmission: 'TRANSMISSION', clear: 'CLEAR LOG', cleared: 'local history cleared',
    responseReady: 'NETRA response received', live: 'LIVE', signal: 'SIGNAL',
  },
  th: {
    open: 'เปิดเครื่องนำทาง NETRA', close: 'ปิดเครื่องนำทาง NETRA',
    title: 'NETRA · เครื่องนำทาง', attached: 'โพรบเชื่อมต่อ · α—04',
    readyState: 'เครื่องนำทางพร้อม', openState: 'ช่องสัญญาณเปิด', busyState: 'กำลังสำรวจ',
    idle: 'เตรียมพร้อม · มองเห็นคลังแล้ว', survey: 'กำลังสำรวจคลัง ·─────',
    placeholder: 'ถามคลังข้อมูล', send: 'ส่งสัญญาณ',
    offline: 'สัญญาณขาดหาย · α คงที่ · ลองอีกครั้ง',
    rateLimited: 'ฉันต้องหยุดสำรวจสักพักค่ะ — วันนี้ α drift เกินเพดานแล้ว.',
    invalidRequest: 'รูปแบบการส่งสัญญาณไม่ถูกต้อง · ตรวจสอบคำถาม', quota: 'โควตาคงเหลือ',
    empty: 'คลังข้อมูลยังเงียบอยู่ที่นี่ ส่งคำถามเพื่อเริ่มการสำรวจ',
    question: 'คำถาม', response: 'ร่องรอย', transcript: 'บันทึกภาคสนาม',
    transmission: 'การส่งสัญญาณ', clear: 'ล้างบันทึก', cleared: 'ล้างประวัติในเครื่องแล้ว',
    responseReady: 'ได้รับคำตอบจาก NETRA แล้ว', live: 'กำลังรับ', signal: 'สัญญาณ',
  },
}

function readHistory(raw: string | null): Message[] {
  if (!raw || raw.length > 200_000) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((item): item is Message => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      return (candidate.role === 'user' || candidate.role === 'assistant')
        && typeof candidate.content === 'string'
        && candidate.content.length > 0
        && candidate.content.length <= 8_000
    }).slice(-20)
  } catch {
    return []
  }
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
  const [messages, setMessages] = useState<Message[]>([])
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<NetraError | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [historyReady, setHistoryReady] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const motionScopeRef = useRef<ReturnType<typeof createScope> | null>(null)
  const mountMotionHandledRef = useRef(false)
  const previousMotionStateRef = useRef<NetraUiState>('ready')
  const state: NetraUiState = busy ? 'busy' : open ? 'open' : 'ready'
  const stateLabel = busy ? t.busyState : open ? t.openState : t.readyState

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
    let saved: string | null = null
    try { saved = localStorage.getItem('wl-netra-history') } catch { /* storage can be unavailable */ }
    queueMicrotask(() => {
      if (!mountedRef.current) return
      setMessages(readHistory(saved))
      setHistoryReady(true)
    })
  }, [])

  useEffect(() => {
    if (!historyReady) return
    try {
      if (messages.length) localStorage.setItem('wl-netra-history', JSON.stringify(messages.slice(-20)))
      else localStorage.removeItem('wl-netra-history')
    } catch {
      // The navigator remains usable when storage is unavailable or full.
    }
  }, [historyReady, messages])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestRef.current?.abort()
    }
  }, [])

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
  }, [answer, messages, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const userMessage: Message = { role: 'user', content: text }
    const next = [...messages, userMessage].slice(-20)
    const controller = new AbortController()
    requestRef.current = controller
    setMessages(next)
    setInput('')
    setAnswer('')
    setBusy(true)
    setProblem(null)
    setAnnouncement(t.survey)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-10), served_lang: locale, page: { pathname } }),
        signal: controller.signal,
      })
      const header = response.headers.get('X-NETRA-Remaining')
      if (header !== null && mountedRef.current) {
        const value = Number(header)
        if (Number.isInteger(value) && value >= 0) setRemaining(value)
      }
      if (!response.ok) {
        const error = await readHttpError(response, t)
        if (mountedRef.current) {
          setProblem(error)
        }
        return
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('NETRA_STREAM_UNAVAILABLE')
      const decoder = new TextDecoder()
      let value = ''
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          value += decoder.decode()
          break
        }
        value += decoder.decode(chunk.value, { stream: true })
        if (mountedRef.current) setAnswer(value)
      }
      if (!value.trim()) throw new Error('NETRA_STREAM_EMPTY')
      if (mountedRef.current) {
        setMessages([...next, { role: 'assistant' as const, content: value }].slice(-20))
        setAnnouncement(t.responseReady)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (mountedRef.current) {
        setProblem({ code: 'NETWORK_UNAVAILABLE', message: t.offline })
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (mountedRef.current) setBusy(false)
    }
  }

  function clearHistory() {
    setMessages([])
    setAnswer('')
    setProblem(null)
    setAnnouncement(t.cleared)
    try { localStorage.removeItem('wl-netra-history') } catch { /* state still clears */ }
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
          {messages.map((message, index) => <div
            key={message.role + '-' + index}
            className={'netra-record netra-record-' + message.role
              + (message.role === 'assistant' ? ' atlas-netra-voice' : '')}
          >
            <p className={'netra-record-label' + (message.role === 'assistant' ? ' voice-tag' : '')}>
              {message.role === 'user' ? t.question : t.response} · {String(index + 1).padStart(2, '0')}
            </p>
            <p className={message.role === 'user' ? 'netra-user' : 'netra-message voice-body'}>{message.content}</p>
          </div>)}
          {busy && <div className="netra-record netra-record-assistant atlas-netra-voice" aria-live="off">
            <p className="netra-record-label voice-tag">{t.response} · {t.live}</p>
            <p className="netra-message voice-body">{answer || '···'}</p>
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
              disabled={busy}
              maxLength={8_000}
              autoComplete="off"
            />
            <button type="submit" disabled={busy || !input.trim()}><span aria-hidden="true">⟶</span> {t.send}</button>
          </div>
        </form>
        <footer className="netra-footer"><span>{t.attached}</span><span>WORLDLINE // NETRA</span></footer>
        <p className="netra-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
      </section>
    </div>}
  </>
}
