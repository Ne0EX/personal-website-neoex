# TO · Sirius (α-SUR-01)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-62
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet

---

## scope

Implement the Nav stratum-indicator per journey-architecture.md v1.2 §3.6.

Default render = FULL/Ne0EX (hidden). Indicator appears when visitor enters NeX, Ne0N, or Ne0.

## acceptance

- Nav renders `· STRATUM <key>` in the right-side readout zone when stratum is not "all"
- 200ms opacity transition on change
- a11y: `aria-live="polite"` on the indicator region
- Zero token violations (design-tokens rail PASS)
- Territory rail PASS
- Mobile breakpoints per §7

## constraints

- Do NOT touch WorldlineGlobe.tsx rendering/camera logic
- Do NOT add new design tokens
- No new npm dependencies without Polaris approval

---

*polaris · α-OPS-00 · 2026-05-15*
