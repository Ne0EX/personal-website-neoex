/**
 * /resume — resume.neoex.dev production page
 *
 * Surface intent: the ONE Worldline page where exhibition/legibility is correct.
 * Keeps the surveyed-paper-instrument soul — but hierarchy serves recruiter
 * fast-scan (~6 s per role). No boot sequence, no globe, no HUD.
 *
 * Layout:
 *   Desktop (≥880px): two-column ledger per entry — 240px meta left, body right
 *     at a deliberate 66ch prose measure (web-typography sweet spot for this mono face).
 *   Mobile (<880px): stacked — meta block compact above body, touch-friendly padding.
 *
 * Spacing scale (refactoring-ui):
 *   Entry py:        32px  (py-8)  — previously 20px, far too tight
 *   Section mb:      56px  (mb-14)
 *   Heading-content: 28px  (mb-7)
 *   Skills row gap:  16px  (gap-y-4)
 *
 * Typography (web-typography):
 *   Body prose:      13.5px, leading-[1.85], max-w-[66ch]
 *   Role:            13px mono, uppercase, font-medium
 *   Date/loc:        10.5px Special Elite
 *
 * Orange gated to: α mark (header) · ◎ current role · .corner-marks CSS class.
 *
 * Modelled after: components/Nav.tsx (mono instrument labels),
 *                 components/FooterManifesto.tsx (section heading pattern).
 */

import type { Metadata } from "next";
import { CornerMarks } from "@/components/CornerMarks";
import { EXPERIENCE, SKILLS, PROJECTS, LINKS } from "./resume-data";
import "./resume.css";

export const metadata: Metadata = {
  title: "Krittiphong Manachamni — AI Engineer",
  description:
    "AI Engineer in Bangkok building production LLM/RAG systems — from data pipelines to low-latency, multi-region serving — working daily in English across global teams.",
};

export default function ResumePage() {
  return (
    <main className="paper-canvas min-h-screen relative">
      <CornerMarks />

      {/* Top instrument bar — suppressed in print via .resume-top-bar */}
      <div className="resume-top-bar nav-shell section-rule-dashed">
        <span className="t-meta text-[var(--ink-soft)]">
          <span className="text-[var(--accent-orange)]">∇</span>{" "}
          WORLDLINE // NEOSPIRIT
        </span>
        <a
          href="/"
          className="t-meta text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors"
          aria-label="Back to Worldline"
        >
          ◇ SITE
        </a>
        <a
          href="mailto:krittiphong2019@gmail.com"
          className="t-meta text-right text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors"
          aria-label="Email Peat"
        >
          ⟶ CONTACT
        </a>
      </div>

      {/* Content column
          Mobile:  px-6/sm:px-10, full viewport width
          Desktop: max-w-[1080px], px-16 — set via .resume-content in resume.css */}
      <div className="resume-content mx-auto px-6 sm:px-10 py-12 pb-16">

        {/* ── HEADER ─────────────────────────────────────────────── */}
        <header className="mb-10 sm:mb-12">
          {/* Observer α mark + Name */}
          <div className="flex items-start gap-3 mb-5">
            <span
              className="t-meta text-[var(--accent-orange)] mt-[12px] sm:mt-[16px] leading-none shrink-0 select-none"
              aria-hidden
            >
              α
            </span>
            <h1 className="t-display text-[40px] sm:text-[52px] leading-[0.95] tracking-[-0.01em] text-[var(--ink-primary)]">
              Krittiphong{" "}
              <span className="italic">&ldquo;Peat&rdquo;</span>{" "}
              Manachamni
            </h1>
          </div>

          <p className="t-meta tracking-[0.22em] text-[var(--ink-soft)] mb-4">
            AI ENGINEER · BANGKOK, THAILAND
          </p>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 t-meta text-[9px] tracking-[0.14em]">
            {LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-[var(--ink-primary)] hover:text-[var(--accent-orange)] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent-orange)]"
              >
                {label}
              </a>
            ))}
          </div>
        </header>

        {/* ── SUMMARY ─────────────────────────────────────────────── */}
        <section aria-label="Summary" className="pt-6 mb-14 section-rule-dashed">
          <p className="t-display italic text-[18px] sm:text-[20px] leading-[1.6] text-[var(--ink-soft)] max-w-[64ch]">
            AI Engineer in Bangkok building production LLM/RAG systems — from
            data pipelines to low-latency, multi-region serving — working daily
            in English across global teams. Rooted in computer-vision and NLP
            research.
          </p>
        </section>

        {/* ── EXPERIENCE ──────────────────────────────────────────── */}
        <section aria-label="Experience" className="mb-14">
          <h2 className="t-meta tracking-[0.3em] mb-7 text-[var(--ink-soft)]">
            § EXPERIENCE
          </h2>

          {EXPERIENCE.map((entry, i) => (
            <div key={entry.company}>
              {/*
                Two-column on desktop via .resume-entry-grid in resume.css.
                Single column on mobile — meta block renders above body.
              */}
              <article className="resume-entry-grid py-8 resume-entry">

                {/* LEFT meta column (240px fixed on desktop) */}
                <div className="resume-meta mb-3">
                  <div className="flex items-center gap-2 mb-2" aria-hidden>
                    <span
                      className={`text-[12px] leading-none ${
                        entry.isCurrent
                          ? "text-[var(--accent-orange)]"
                          : "text-[var(--ink-faint)]"
                      }`}
                    >
                      {entry.isCurrent ? "◎" : "○"}
                    </span>
                    <span className="t-type text-[8.5px] text-[var(--ink-faint)] tracking-[0.04em]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Role — most prominent element in meta column */}
                  <div className="t-mono font-medium text-[13px] tracking-[0.1em] uppercase text-[var(--ink-primary)] leading-tight mb-1.5">
                    {entry.role}
                  </div>

                  {/* Company */}
                  <div className="t-mono text-[12px] tracking-[0.03em] text-[var(--ink-soft)] mb-3 leading-tight">
                    {entry.company}
                  </div>

                  {/* WHERE · DATE — Special Elite typewriter register */}
                  <div className="t-type text-[10.5px] tracking-[0.06em] text-[var(--ink-faint)] leading-[1.8]">
                    {entry.location}
                    <br />
                    {entry.period}
                  </div>
                </div>

                {/* RIGHT body column — prose at deliberate 66ch measure */}
                <div className="resume-body">
                  <p className="t-mono text-[13.5px] leading-[1.85] tracking-[0.01em] text-[var(--ink-primary)] max-w-[66ch]">
                    {entry.body}
                  </p>
                </div>
              </article>

              {i < EXPERIENCE.length - 1 && (
                <div className="section-rule-dashed resume-separator" aria-hidden />
              )}
            </div>
          ))}
        </section>

        <div className="section-rule-dashed mb-14" aria-hidden />

        {/* ── SKILLS ──────────────────────────────────────────────── */}
        <section aria-label="Skills" className="mb-14">
          <h2 className="t-meta tracking-[0.3em] mb-7 text-[var(--ink-soft)]">
            § SKILLS
          </h2>
          {/* Skills grid mirrors 240px meta column on desktop via .resume-skills-grid */}
          <dl className="resume-skills-grid">
            {SKILLS.map(({ label, items }) => (
              <div key={label} className="contents">
                <dt className="t-mono text-[9px] tracking-[0.22em] uppercase text-[var(--ink-soft)] resume-skill-label">
                  {label}
                </dt>
                <dd className="t-mono text-[12.5px] tracking-[0.02em] text-[var(--ink-primary)] leading-[1.7] resume-skill-value">
                  {items}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="section-rule-dashed mb-14" aria-hidden />

        {/* ── SELECTED PROJECTS ───────────────────────────────────── */}
        <section aria-label="Selected Projects" className="mb-14">
          <h2 className="t-meta tracking-[0.3em] mb-7 text-[var(--ink-soft)]">
            § SELECTED PROJECTS
          </h2>
          <ul className="grid gap-4" role="list">
            {PROJECTS.map(({ name, desc }) => (
              <li key={name} className="flex items-baseline gap-3">
                <span className="text-[var(--ink-faint)] text-[9px] shrink-0" aria-hidden>◇</span>
                <p className="t-mono text-[13px] leading-[1.8] tracking-[0.01em] text-[var(--ink-primary)] max-w-[64ch]">
                  <strong className="font-medium">{name}</strong>
                  {" — "}
                  <span className="text-[var(--ink-soft)]">{desc}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="section-rule-dashed mb-14" aria-hidden />

        {/* ── RECOGNITION · EDUCATION · LANGUAGES ─────────────────── */}
        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
          <section aria-label="Recognition" className="sm:col-span-2">
            <h2 className="t-meta tracking-[0.3em] mb-4 text-[var(--ink-soft)]">§ RECOGNITION</h2>
            <p className="t-mono text-[12.5px] leading-[1.9] tracking-[0.015em] text-[var(--ink-primary)] max-w-[72ch]">
              Silver Medal, Super AI Engineer S1 (1 of 19 nationwide) · TED Fund
              grant · AWS Build on ASEAN finalist · JSTP scholar
            </p>
          </section>

          <section aria-label="Education">
            <h2 className="t-meta tracking-[0.3em] mb-4 text-[var(--ink-soft)]">§ EDUCATION</h2>
            <dl className="grid gap-4">
              <div>
                <dt className="t-mono text-[12.5px] tracking-[0.04em] text-[var(--ink-primary)] leading-tight">
                  B.Eng, Environmental Engineering
                </dt>
                <dd className="t-type text-[10.5px] tracking-[0.06em] text-[var(--ink-faint)] mt-1.5">
                  Chulalongkorn University · 2020–2024
                </dd>
              </div>
              <div>
                <dt className="t-mono text-[12.5px] tracking-[0.04em] text-[var(--ink-primary)] leading-tight">
                  Mahidol Wittayanusorn School (MWIT)
                </dt>
                <dd className="t-type text-[10.5px] tracking-[0.06em] text-[var(--ink-faint)] mt-1.5">
                  Science-gifted program
                </dd>
              </div>
            </dl>
          </section>

          <section aria-label="Languages">
            <h2 className="t-meta tracking-[0.3em] mb-4 text-[var(--ink-soft)]">§ LANGUAGES</h2>
            <p className="t-mono text-[12.5px] leading-[1.9] tracking-[0.015em] text-[var(--ink-primary)]">
              Thai (native)<br />
              English (professional, daily in global teams)
            </p>
          </section>
        </div>

        {/* Bottom instrument stamp */}
        <div className="mt-12 pt-5 section-rule-dashed flex items-baseline justify-between t-meta text-[var(--ink-faint)]">
          <span>∇ WORLDLINE · NEOEX.DEV</span>
          <span className="t-type text-[9px] tracking-[0.04em]">resume.neoex.dev</span>
        </div>
      </div>
    </main>
  );
}
