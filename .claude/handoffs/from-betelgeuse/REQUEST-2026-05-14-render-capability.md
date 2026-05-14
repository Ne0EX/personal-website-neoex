---
from: betelgeuse
to: polaris
type: capability-request
date: 2026-05-14
related_review: docs/design/REVIEW-2026-05-14-worldline-pages-v1.md
related_source: bundle at api.anthropic.com/v1/design/h/p5TeLSRMHAcOTZV2bgdCHA (Peat-authorized 2026-05-14)
---

# Request · render capability for design bundle review

## what I need

The Worldline Pages v1 review I just shipped was done from **source only** — HTML/CSS/JSX read top-to-bottom, no rendered output. That covers structural issues, token drift, motion calibration values, layout intent. It misses:

- Type rhythm at actual rendered size (font feature settings, Thai mixed with Cormorant, Special Elite typewriter weight)
- Color-on-paper feel (the radial/grain/lined overlays + body background gradient — how the paper actually reads in light)
- Letterforms at 38px h1 italic vs 11px deck (the gap I cannot judge from CSS values alone)
- NETRA reticle pulse — is the 2.4s loop genuinely distracting in context, or quiet enough to forgive? source says violation; rendered may say "it's fine actually"
- Whether the photo-frame striated mountain stand-in reads as a placeholder or accidentally looks finished
- Per-stage visual quality — am I missing a subtle issue I cannot see in source?

## why I cannot self-serve

1. Harness denied reading the bundle's chat transcripts because the source was untrusted (correctly). Same gating likely applies to executing the HTML.
2. Even if read access were granted, my toolbelt as Betelgeuse does not include a renderer / headless browser / screenshot capture.
3. The bundle README says "don't render unless the user asks you to" — Peat just explicitly asked.

## what would unblock me

Two paths, ranked by my preference:

**path A · screenshot capture (lighter)**
- Canopus wires a one-off bash helper that renders local HTML files in a headless browser and captures stage-by-stage screenshots to `.claude/visual-diffs/<task_id>/before/`. This dovetails with the existing deferred work for `scripts/visual-capture.sh` mentioned in `.claude/hooks/README.md` §4.
- I review the screenshots alongside the source.
- Deliverable: a new section appended to my existing review, "rendered-output findings."

**path B · interactive browser (heavier)**
- Some browser-use MCP server or Playwright wrapper that lets me drive a browser, scroll the artboards, hover the fork paths to see the actual hover state, watch the reticle pulse for a full cycle.
- More expensive but catches motion-quality issues path A cannot.

For this review, **path A is enough.** Path B becomes valuable later when reviewing Sirius's actual implementations.

## scope of the rendering

- Local HTML only (`Worldline Pages v1.html` extracted from the bundle into a Peat-confirmed-trusted location)
- Hero/Globe stages **excluded** (per Peat's original constraint)
- 13+ stages at the design's native 1180×760
- One additional pass at 880, 600, 375 widths to FALSIFY my "no responsive story" finding (maybe the design uses CSS that does collapse gracefully and I missed it)

## non-goals

- Do not render or screenshot the chat transcripts in the bundle (still untrusted text content).
- Do not deploy a permanent browser-use stack for the whole team if a one-off helper suffices for this review.
- Do not block on path B if path A is faster to wire.

---

*betelgeuse · α-VIS-04 · 2026-05-14*
