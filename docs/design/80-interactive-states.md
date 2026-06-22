# docs/design/80-interactive-states.md
# Interactive Element Token System

**agent:** Betelgeuse α-VIS-04
**date:** 2026-06-22
**status:** CANONICAL — source of truth for all --ctl-* tokens
**gallery atom:** A18 · interactive-state-system
**gallery location:** `.claude/visual-diffs/soul-atlas/gallery.html`
**token source:** `app/globals.css` lines 158–334

---

## intent

Every interactive control on the site — buttons, segmented tabs, locale
toggles, filter pills, status badges — draws from one semantic token
set. The `--ctl-*` namespace. Nothing in `components/**` invents its own
active color. Nothing uses raw hex for a control surface.

This surface communicates: *the instrument has controls, not affordances.
They are functional but quiet — they belong to the paper, not to a UI
kit.*

---

## variant families

Six families. Each answers a distinct interaction contract.

### 1. fill — the heaviest weight

**Use for:** the single primary action on a surface (commit, publish,
submit), or the active/selected item in a segmented control row.

**Do not use:** for secondary actions, cancel buttons, or anything that
should recede.

**Decision guide:** if only one action on this surface should ever be
pressed, it is fill. If the user is choosing between options in a row,
the selected item is fill via the segment family (which inherits fill
tokens).

| state    | background               | foreground               |
|----------|--------------------------|--------------------------|
| rest     | `var(--ctl-fill-bg)`     | `var(--ctl-fill-fg)`     |
| hover    | `var(--ctl-fill-bg-hover)` | `var(--ctl-fill-fg-hover)` |
| active   | same as rest (it IS the active state) | same |
| disabled | opacity `var(--ctl-disabled-opacity)` on the rest state |
| focus    | `1px dashed var(--ctl-focus-ring)`, `-2px` offset |

**Light values:**
- `--ctl-fill-bg` → `var(--ink-primary)` → `rgb(31 80 99)` teal
- `--ctl-fill-fg` → `var(--paper-base)` → `#E8E2D5` aged cream
- `--ctl-fill-bg-hover` → `var(--accent-orange)` → `#D4602A`
- `--ctl-fill-fg-hover` → `var(--paper-bright)` → `#F0EBDD`

**Dark values (explicit overrides in `[data-theme="dark"]`):**
- `--ctl-fill-bg` → `var(--paper-bright)` → `#1E2F37` raised teal-charcoal
- `--ctl-fill-fg` → `var(--ink-primary)` → `rgb(216 224 222)` cool cream

**Rationale for dark fill being paper-bright, not white:**
In dark mode, `--ink-primary` resolves to a cool cream — using it as a
button *background* would produce a glaring white-on-dark panel that
breaks the quiet instrument register. `--paper-bright` (`#1E2F37`) is
the lightest surface in the dark palette: an elevated teal-charcoal that
reads as "selected / raised" without screaming. Text on it is the cool
cream ink, which gives the same visual contract (light text on dark
surface) but stays within the same aged-paper-in-a-darkroom tonal range.

**RULE: do NOT use `var(--ink-primary)` as a control background.**
In light mode it produces a dark teal block (correct). In dark mode it
resolves to near-white (38% contrast against `--paper-base`). The token
is an ink color — it is for text, hairlines, borders. Using it as a fill
background in a dark-mode-aware component is a silent failure.

**Backward compatibility:** `--btn-fill` and `--btn-fill-fg` are aliases
of `--ctl-fill-bg` / `--ctl-fill-fg`. They resolve identically. Existing
consumers (`.ef-commit`, `.pub-btn-primary`, etc.) need not change.

---

### 2. ghost — secondary action

**Use for:** secondary actions, cancel, less-urgent options alongside a
primary fill button. Any button that should recede visually.

**Decision guide:** if you have two buttons side by side, the one the
user is *more likely* to press is fill; the other is ghost. If there is
no hierarchy, both are ghost.

| state    | border                          | foreground                       |
|----------|---------------------------------|----------------------------------|
| rest     | `1px solid var(--ctl-ghost-border)` | `var(--ctl-ghost-fg)`       |
| hover    | `1px solid var(--ctl-ghost-border-hover)` | `var(--ctl-ghost-fg-hover)` |
| disabled | opacity `var(--ctl-disabled-opacity)` |                            |
| focus    | `1px dashed var(--ctl-focus-ring)`, `-2px` offset |               |

**Dashed sub-variant:**
When a ghost button has less authority than a regular ghost (e.g. a
"publish" option that is not the primary commit), use:
- border: `1px dashed var(--ctl-ghost-border-dashed)` → `var(--ink-dashed)` (25% ink)
- foreground: `var(--ctl-ghost-fg-dashed)` → `var(--ink-faint)` (30% ink)

These derive from the existing ink scale; no dark override needed.

---

### 3. segment — mutually exclusive view modes

**Use for:** mode tabs where exactly one is always selected (TIMELINE /
FLAT / PLACE, SOURCE / PREVIEW / SPLIT, kind-filter kind tabs).

**Do not use:** for independent toggles. Segment implies a radio group.

**Structure:** the segment rail (`.gv-modes`, `.ed-modes`, `.ed-kindtabs`)
carries a `1px solid var(--ctl-seg-divider)` outer border. Individual
items have **no** border of their own — dividers are `border-left: 1px
solid var(--ctl-seg-divider)` between items only.

| state     | background                   | foreground                  |
|-----------|------------------------------|-----------------------------|
| inactive  | `var(--ctl-seg-bg)` = transparent | `var(--ctl-seg-fg)` = ink-soft |
| hover     | transparent                  | `var(--ctl-seg-fg-hover)` = ink-primary |
| selected  | `var(--ctl-seg-active-bg)`   | `var(--ctl-seg-active-fg)`  |
| focus     | `1px dashed var(--ctl-focus-ring)`, `-2px` offset |              |

The selected item inherits fill tokens via `--ctl-seg-active-bg: var(--ctl-fill-bg)`,
so the dark-mode fill override cascades automatically.

---

### 4. text — locale toggle, inline nav

**Use for:** the EN·TH locale register toggle, plain nav links styled as
inline controls. No border, no fill at any state.

**Do not use:** for any button that performs a mutation (submit, commit,
delete). Those are fill or ghost.

| state   | foreground                        |
|---------|-----------------------------------|
| inactive | `var(--ctl-text-fg)` = ink-soft  |
| hover   | `var(--ctl-text-fg-hover)` = accent-orange |
| active  | `var(--ctl-text-fg-active)` = ink-primary |

No dark override required: all three derive from the base tokens which
flip automatically.

---

### 5. register — DAY · NIGHT theme toggle

**Use for:** exactly the DAY · NIGHT pair. The active mode is signalled
by an orange `2px` bottom bar, not a fill. The paper texture shows
through, which is deliberate — the instrument chrome reads *through* the
toggle, not behind it.

**Do not use:** for any other binary toggle. The underline-bar is a
signature tied to the paper-register conceit of the theme switcher.

| state    | foreground                         | bar                         |
|----------|------------------------------------|-----------------------------|
| inactive | `var(--ctl-reg-fg)` = ink-soft    | none                        |
| hover    | `var(--ctl-reg-fg-hover)` = accent-orange | none               |
| active   | `var(--ctl-reg-fg-active)` = accent-orange | `var(--ctl-reg-bar)` = accent-orange, 2px bottom |

---

### 6. pill — attractor domain pills, kind-filter pills

**Use for:** `.af-pill` attractor field badges, kind-filter selection
pills. Transparent rest, orange hover, filled-ink active.

**Do not use:** for status display (that is the status badge). Pills are
interactive; status badges are read-only.

| state   | border                              | background            | foreground           |
|---------|-------------------------------------|-----------------------|----------------------|
| rest    | `1px solid var(--ctl-pill-border)` = ink-faint | transparent | `var(--ctl-pill-fg)` = ink-primary |
| hover   | `1px solid var(--ctl-pill-border-hover)` = accent-orange | transparent | `var(--ctl-pill-fg-hover)` = accent-orange |
| active  | `1px solid var(--ctl-pill-border-active)` | `var(--ctl-pill-bg-active)` = ctl-fill-bg | `var(--ctl-pill-fg-active)` = ctl-fill-fg |
| focus   | `1px dashed var(--ctl-focus-ring)`, `-2px` offset | | |

The active state inherits fill tokens, so it reads as the same weight as
a fill button but in pill geometry.

---

### 7. status badge — PUBLISHED / DRAFT / SETTLED

**Use for:** read-only entry status. This is a display atom only — never
interactive. Never use `cursor:pointer` on a status badge.

| variant   | background                   | foreground                       |
|-----------|------------------------------|----------------------------------|
| PUBLISHED | `var(--ctl-status-pub-bg)` = ctl-fill-bg | `var(--ctl-status-pub-fg)` = ctl-fill-fg |
| DRAFT     | none                         | `var(--ctl-status-draft-fg)` = ink-faint |
| SETTLED   | none                         | `var(--ctl-status-settled-fg)` = ink-primary |

PUBLISHED uses fill-weight because it is the terminal committed state.
DRAFT is ambient — intentionally barely visible. SETTLED is ink-primary
emphasis; the entry has landed.

---

## shared: focus ring + disabled

**Focus ring** (all interactive variants):
```css
outline: 1px dashed var(--ctl-focus-ring);
outline-offset: -2px;
```
`--ctl-focus-ring` → `var(--accent-orange)`. The orange accent is the
observer mark — active, selected, focused. All three states converge on
the same hue. This is intentional: the instrument registers "something is
happening here" in one color.

**Disabled:**
```css
opacity: var(--ctl-disabled-opacity); /* 0.45 */
pointer-events: none;
```
No appearance change other than opacity. The shape and color of the
control should still communicate what it *would* do.

---

## light vs dark — what changes, what derives

The dark theme is a token swap in `[data-theme="dark"]`. It overrides
the base palette (`--paper-*`, `--ink-rgb`, `--accent-orange`). Every
`--ctl-*` token that chains from those primitives flips automatically.

The only `--ctl-*` token with an explicit dark override is:
- `--ctl-fill-bg` → `var(--paper-bright)` (#1E2F37) — *because* fill in
  the dark system means "elevated/raised" not "filled with ink-primary
  (which is now cream)"

Everything else:
- `--ctl-ghost-*` derives from ink scale → flips automatically
- `--ctl-seg-*` derives from fill + ink → cascades from the fill override
- `--ctl-text-*` derives from ink + accent → flips automatically
- `--ctl-reg-*` derives from ink-soft + accent-orange (brightened in dark) → flips
- `--ctl-pill-*` derives from ink + fill → cascades
- `--ctl-status-*` derives from fill → cascades
- `--ctl-focus-ring` = accent-orange (brightened in dark) → flips
- `--ctl-disabled-opacity` = scalar → no change

---

## token index

```
--ctl-fill-bg              fill background (rest + active = same; it IS the active state)
--ctl-fill-fg              fill foreground
--ctl-fill-bg-hover        fill background on hover (accent-orange)
--ctl-fill-fg-hover        fill foreground on hover (paper-bright)

--ctl-ghost-border         ghost rest border (ink-hairline, barely there)
--ctl-ghost-fg             ghost rest foreground
--ctl-ghost-border-hover   ghost hover border (accent-orange)
--ctl-ghost-fg-hover       ghost hover foreground (accent-orange)
--ctl-ghost-border-dashed  dashed sub-variant border (ink-dashed, 25%)
--ctl-ghost-fg-dashed      dashed sub-variant foreground (ink-faint, 30%)

--ctl-seg-bg               segment inactive background (transparent)
--ctl-seg-fg               segment inactive foreground (ink-soft)
--ctl-seg-fg-hover         segment hover foreground (ink-primary)
--ctl-seg-active-bg        segment selected background (= ctl-fill-bg)
--ctl-seg-active-fg        segment selected foreground (= ctl-fill-fg)
--ctl-seg-divider          between-item border (ink-hairline)

--ctl-text-fg              text inactive (ink-soft)
--ctl-text-fg-active       text active (ink-primary)
--ctl-text-fg-hover        text hover (accent-orange)

--ctl-reg-fg               register inactive (ink-soft)
--ctl-reg-fg-hover         register hover (accent-orange)
--ctl-reg-fg-active        register active (accent-orange)
--ctl-reg-bar              register active underline (accent-orange, 2px bottom)

--ctl-pill-border          pill rest border (ink-faint)
--ctl-pill-fg              pill rest foreground (ink-primary)
--ctl-pill-border-hover    pill hover border (accent-orange)
--ctl-pill-fg-hover        pill hover foreground (accent-orange)
--ctl-pill-bg-active       pill active background (= ctl-fill-bg)
--ctl-pill-border-active   pill active border (= ctl-fill-bg)
--ctl-pill-fg-active       pill active foreground (= ctl-fill-fg)

--ctl-status-pub-bg        PUBLISHED background (= ctl-fill-bg)
--ctl-status-pub-fg        PUBLISHED foreground (= ctl-fill-fg)
--ctl-status-draft-fg      DRAFT foreground (ink-faint)
--ctl-status-settled-fg    SETTLED foreground (ink-primary)

--ctl-focus-ring           focus ring color (accent-orange)
--ctl-disabled-opacity     disabled opacity (0.45)

--btn-fill                 backward-compat alias → ctl-fill-bg
--btn-fill-fg              backward-compat alias → ctl-fill-fg
```

---

## non-goals

- This system does not cover form inputs (text fields, selects, textareas).
  Those have their own semantic treatment in the console.
- No animation tokens here. Motion lives in the motion spec (see
  docs/design/22-mobile-native-ladder.md §motion for the calibration table).
  Interactive controls use 100–150ms hover transitions.
- No per-component shadow or elevation. The instrument is flat. The fill
  token is the elevation signal.
- No dark-mode per-component overrides in `components/**`. The cascade
  handles everything.

---

## references

- `app/globals.css` lines 158–334 — the canonical token declarations
- `components/console/ConsoleApp.tsx` — fill (commit), ghost (cancel), segment (kind tabs)
- `components/console/ConsoleEntryForm.tsx` — fill, ghost, status badge
- `components/ArchiveFilters.tsx` — pill and text variants
- `components/Nav.tsx` — register (DAY·NIGHT), text (locale EN·TH)
- `docs/design/15-console.md` — console surface spec (the first surface to use fill + ghost + segment at scale)
- `docs/design/22-mobile-native-ladder.md` — motion calibration table
