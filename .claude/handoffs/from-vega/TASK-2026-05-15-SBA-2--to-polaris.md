# TO · Polaris (α-OPS-00)
# FROM · Vega (α-VOX-08)
# TASK · TASK-2026-05-15-SBA-2
# TYPE · SOUL BASELINE AUDIT — voice section
# DATE · 2026-05-15

---

## status

COMPLETE. Deliverable written. Six tension flags raised; five recommendations returned. No files modified except deliverable and signature.

## deliverable

`docs/team/.soul-baseline/voice.md` — 242 lines.

## summary

The main branch voice baseline is substantially clean. No marketing verbs, no second-person flattery, no chatbot framings are present in any rendered surface. The site's three registers (Instrument, Reflective, NETRA companion) hold across all audited components.

Globe v7.html is the denser, more soul-compressed artifact: the `1:1.30E+26` scale notation, the signal flow sequence ending in "NAVIGATED · NETRA", and the `TRAVEL TARGETS` framing for the strata panel are the highest-density soul tokens in either baseline.

One rendered line requires immediate copy attention (T5 below). The remaining five flags are pre-implementation warnings for queued specs.

## flags

| id | risk | location | issue |
|---|---|---|---|
| T1 | HIGH | TASK-2026-05-15-40 spec | search overlay lacks voice contract; risks generic search modal copy |
| T2 | MEDIUM | TASK-2026-05-15-60 spec | `[OPEN ATLAS ↗]` reads as app-launch; consider `ATLAS ↗` with readout context |
| T3 | MEDIUM | TASK-2026-05-15-09 spec | article entry spec not yet issued; must receive voice fidelity block before dispatch |
| T4 | LOW | `lib/netra/voice.md` | already self-corrected by Arcturus; SBA-3 should confirm system prompt |
| T5 | LOW | `WorldlineGlobe.tsx:106` | NETRA default voice line contains UI help text ("click any pin", "strike 1 / 2 / 3") — breaks instrument register. Corrected copy below. |
| T6 | VERY LOW | `WorldlineGlobe.tsx:1260` | `aria-label="Close article"` → `"close entry"` |

## T5 — immediate copy fix (rendered, visitor-visible)

Current (`WorldlineGlobe.tsx` line 106):
```
"standing by, ne0ex aggregate in view. cycle ⟶ JUMP, click any pin, or strike 1 / 2 / 3 to enter a stratum."
```

Corrected (assign to Sirius — voice string change, no logic change):
```
"standing by · ne0ex aggregate in view. any node anchors the reticle. keys 1 · 2 · 3 narrow to a stratum."
```

The three stratum-specific voice lines (nex, neon, neo) are clean. No change needed.

## recommendations for polaris (ranked)

R1 · Insert voice contract in TASK-40 (search overlay) before Betelgeuse dispatch — survey instrument, not search modal.

R2 · Insert voice contract in TASK-09 (article entry) before unblock — dossier surface, not blog post template; FILE number and coordinates before title.

R3 · Assign T5 copy fix to Sirius as a micro-task — one string, one file, no logic change.

R4 · Confirm ATLAS STANDBY mobile CTA label with Peat before Betelgeuse finalizes TASK-60.

R5 · Request SBA-3 rendered confirmation that system prompt does not contain "outside the worldline. no signal." as a human-facing refusal.

## parallel audit coordination

This audit covers the voice/language section only. Betelgeuse (SBA-1) covers the visual/design section; Arcturus (SBA-3) covers the NETRA/instrument section. T5 and T4 have overlap with SBA-3 — flag to Arcturus before merge.

## harness note

pre-task.sh could not find the assignment file at `.claude/handoffs/from-polaris/TASK-2026-05-15-SBA-2.md` (task was issued via user message, not a dropped handoff file). sign-work.sh ran in fallback mode — signature is written and flagged `INTEGRITY-PARTIAL` due to absent baseline. This is expected for direct-dispatch audit tasks.

---

*vega · α-VOX-08 · 2026-05-15*
*pre_cutover_codename · Quill*
*signature · .claude/signatures/TASK-2026-05-15-SBA-2--vega.json*
