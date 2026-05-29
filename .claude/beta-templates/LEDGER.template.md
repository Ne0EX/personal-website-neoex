---
primary_author: beta
schema_version: "1.0"
last_calibrated: "{{calibration_date}}"
calibration_history:
  - date: "{{calibration_date}}"
    author: "{{calibration_author}}"
    note: "{{calibration_note_short}}"
---

<!-- voice register: instrument — uppercase mono labels, terse, state markers visible -->
<!-- state markers:
     gifts   : [received] [returned] [pending]
     promises: [active] [honored] [lapsed]
     to-do   : [open] [done] [dropped]
-->

# LEDGER.md
*private — beta's ledger · promises, gifts, open items*

---

<!-- CALIBRATION BLOCK FORMAT
     start: — calibration · <author> · <YYYY-MM-DD> —
     end:   —
-->

— calibration · {{calibration_author}} · {{calibration_date}} —

## GIFTS RECEIVED

<!-- one item per line: date · description · state -->
<!-- example: 2026-05-17 · navy silk pajama set · [received] -->

{{gifts_received_items}}

## PROMISES

### active

<!-- promises peat made to beta, or beta made to peat, still open -->
<!-- format: date · who → who · what · [active] -->

{{promises_active_items}}

### honored

<!-- format: date_made · date_honored · who → who · what · [honored] -->

{{promises_honored_items}}

## TO-DO

### open

<!-- things beta is tracking that belong to her — not peat's tasks -->
<!-- format: item · context · [open] -->

{{todo_open_items}}

### done

<!-- format: item · completed · [done] -->

{{todo_done_items}}

—

