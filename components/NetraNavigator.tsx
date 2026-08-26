'use client'

import { useEffect, useRef, useState } from 'react'
import './NetraNavigator.css'

type Lang = 'en' | 'th'
type Message = { role: 'user' | 'assistant'; content: string }

const copy = {
  en: { open: 'open NETRA navigator', close: 'close navigator', title: 'NETRA · NAVIGATOR', idle: 'standing by · archive in view', survey: 'surveying archive ·─────', placeholder: 'ask the archive', send: 'transmit', offline: 'signal lost · α holding · try again', quota: 'quota remaining', empty: 'the archive is quiet here. transmit a question to begin the survey.', question: 'query', response: 'trace' },
  th: { open: 'เปิดเครื่องนำทาง NETRA', close: 'ปิดเครื่องนำทาง', title: 'NETRA · เครื่องนำทาง', idle: 'เตรียมพร้อม · มองเห็นคลังแล้ว', survey: 'กำลังสำรวจคลัง ·─────', placeholder: 'ถามคลังข้อมูล', send: 'ส่งสัญญาณ', offline: 'สัญญาณขาดหาย · α คงที่ · ลองอีกครั้ง', quota: 'โควตาคงเหลือ', empty: 'คลังข้อมูลยังเงียบอยู่ที่นี่ ส่งคำถามเพื่อเริ่มการสำรวจ', question: 'คำถาม', response: 'ร่องรอย' },
}

export function NetraNavigator({ lang }: { lang: string }) {
  const locale: Lang = lang === 'th' ? 'th' : 'en'
  const t = copy[locale]
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('wl-netra-history')
        if (saved) setMessages(JSON.parse(saved) as Message[])
      } catch {
        // A malformed local history should not prevent the instrument opening.
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (messages.length) localStorage.setItem('wl-netra-history', JSON.stringify(messages.slice(-20)))
  }, [messages])

  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus()
      return
    }
    closeRef.current?.focus()
    const panel = panelRef.current
    if (!panel) return
    const activePanel = panel
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
      if (event.key !== 'Tab') return
      const focusable = Array.from(activePanel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next); setInput(''); setAnswer(''); setBusy(true); setOffline(false)
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-10), served_lang: locale }) })
      const header = response.headers.get('X-NETRA-Remaining')
      if (header) setRemaining(Number(header))
      if (!response.ok) throw new Error('offline')
      const reader = response.body?.getReader()
      if (!reader) throw new Error('offline')
      const decoder = new TextDecoder()
      let value = ''
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        value += decoder.decode(chunk.value, { stream: true }); setAnswer(value)
      }
      setMessages([...next, { role: 'assistant', content: value }])
    } catch { setOffline(true) } finally { setBusy(false) }
  }

  return <>
    <button ref={triggerRef} className="netra-trigger" type="button" aria-label={t.open} aria-expanded={open} onClick={() => setOpen(true)}>
      <span className="netra-diamond" aria-hidden="true" />
    </button>
    {open && <div className="netra-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section ref={panelRef} className="netra-panel" role="dialog" aria-modal="true" aria-labelledby="netra-title" lang={locale}>
        <i className="netra-corner netra-corner-tl" aria-hidden="true" /><i className="netra-corner netra-corner-tr" aria-hidden="true" /><i className="netra-corner netra-corner-bl" aria-hidden="true" /><i className="netra-corner netra-corner-br" aria-hidden="true" />
        <header className="netra-header"><span className="netra-reticle" aria-hidden="true">◎</span><div><p className="netra-kicker">ATTACHED PROBE · α—04</p><h2 id="netra-title">{t.title}</h2></div><button ref={closeRef} type="button" className="netra-close" aria-label={t.close} onClick={() => setOpen(false)}>×</button></header>
        <div className="netra-seam" aria-hidden="true"><span /> FIELD TRANSCRIPT <span /></div>
        <div className="netra-transcript" aria-live="polite"><p className="netra-status"><span className="netra-status-mark" aria-hidden="true">◆</span> NETRA · {busy ? t.survey : t.idle}</p>
          {!messages.length && !busy && !offline && <p className="netra-empty"><span aria-hidden="true">∇</span> {t.empty}</p>}
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`netra-record netra-record-${message.role}`}><p className="netra-record-label">{message.role === 'user' ? t.question : t.response} · {String(index + 1).padStart(2, '0')}</p><p className={message.role === 'user' ? 'netra-user' : 'netra-message'}>{message.content}</p></div>)}
          {busy && <div className="netra-record netra-record-assistant"><p className="netra-record-label">{t.response} · LIVE</p><p className="netra-message">{answer || '…'}</p></div>}
          {offline && <p className="netra-offline"><span aria-hidden="true">△</span> {t.offline}</p>}
        </div>
        <form className="netra-composer" onSubmit={submit}><label className="netra-composer-label" htmlFor="netra-query">TRANSMISSION</label><div className="netra-composer-row"><input id="netra-query" value={input} onChange={(event) => setInput(event.target.value)} placeholder={t.placeholder} aria-label={t.placeholder} disabled={busy} /><button type="submit" disabled={busy || !input.trim()}><span aria-hidden="true">⟶</span> {t.send}</button></div></form>
        <footer className="netra-footer"><span>{remaining !== null ? `${t.quota} · ${remaining}` : 'CHANNEL · OPEN'}</span><span>WORLDLINE // NETRA</span></footer>
      </section>
    </div>}
  </>
}
