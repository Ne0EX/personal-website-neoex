---
task_id: TASK-2026-05-15-11
from: polaris
to: arcturus + betelgeuse
date: 2026-05-15
priority: high
status: queued
blocked_by: TASK-2026-05-15-08
model:
  S1 (Arcturus, NETRA prompt arch): opus  ← per-task escalation per rubric (NETRA system-prompt architecture)
  S2 (Betelgeuse, chat UI): sonnet
---

# TASK-2026-05-15-11 · NETRA chat spec · QUEUED

Blocked on TASK_α. Will be fully detailed once α closes.

## scope (placeholder)

Two-agent task — Arcturus owns the NETRA prompt architecture and refusal taxonomy; Betelgeuse owns the chat UI design. Both produce specs; Sirius implements later from the combined contract.

Stage 05 (NETRA Chat) from Claude Design as starting reference for UI; PRD-05 + `.claude/agents/arcturus.md` territory for prompt arch.

## predicted slices (subject to α)

- S1 · Arcturus · NETRA system-prompt architecture, tool surface, refusal taxonomy, voice spec. Opus tier — meets per-task escalation rubric for `arcturus.md`. Produces `docs/netra/system-prompt.md` + tool definitions.
- S2 · Betelgeuse · chat UI design spec at `docs/design/netra-chat-PRD05.md`. Depends partially on S1's tool surface (what tools render in UI?) — can be drafted in parallel after α and reconciled.
- S3 · Sync · cross-agent contract review (Arcturus + Betelgeuse agree on what message types, tool invocations, and state transitions render where)

S1 can run parallel to TASK-09 and TASK-10 — different agents, no overlap.

---

*polaris · α-OPS-00 · 2026-05-15 · queued · awaiting α*
