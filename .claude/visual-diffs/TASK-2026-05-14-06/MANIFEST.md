# MANIFEST · TASK-2026-05-14-06 · Worldline Pages v1 stage screenshots

Produced by Canopus (α-HRN-07) · 2026-05-14 · S1 of TASK-2026-05-14-06

## Source

- Design file: `Worldline Pages v1 (2).html` (Peat-authorized, 2026-05-14)
- Extracted to: `.claude/visual-diffs/TASK-2026-05-14-06/source/demo-saved.html`
- Source file version: Chrome "Save Page As" capture of the live Claude design tool session
- Renderer: Playwright 1.60.0 / Chromium headless (Chrome 148 for Testing)
- Render method: `scripts/render-html.sh` — local HTTP server + element-level locator screenshot

## Stage discovery

15 stages found via `data-screen-label` attribute scan:
- 13 native stages captured (01–13)
- 01B (Thai variant) excluded per task contract
- Duplicate-numbered "12 Boot · Complete" excluded per task contract
- 9 responsive captures added for stages 01, 02, 05 at 880×760, 600×760, 375×760

## Screenshots — 22 total

Sorted by stage number, then viewport descending.

| filename | stage label | viewport | file size (bytes) |
|----------|-------------|----------|-------------------|
| `01-article-entry-1180x760.png` | 01 Article Entry | 1180x760 | 234,334 |
| `01-article-entry-880x760.png` | 01 Article Entry | 880x760 | 186,467 |
| `01-article-entry-600x760.png` | 01 Article Entry | 600x760 | 149,633 |
| `01-article-entry-375x760.png` | 01 Article Entry | 375x760 | 83,749 |
| `02-audience-fork-1180x760.png` | 02 Audience Fork | 1180x760 | 138,991 |
| `02-audience-fork-880x760.png` | 02 Audience Fork | 880x760 | 125,616 |
| `02-audience-fork-600x760.png` | 02 Audience Fork | 600x760 | 87,595 |
| `02-audience-fork-375x760.png` | 02 Audience Fork | 375x760 | 60,597 |
| `03-photo-entry-1180x760.png` | 03 Photo Entry | 1180x760 | 276,338 |
| `04-triangulate-search-1180x760.png` | 04 Triangulate Search | 1180x760 | 201,319 |
| `05-netra-chat-1180x760.png` | 05 NETRA Chat | 1180x760 | 179,998 |
| `05-netra-chat-880x760.png` | 05 NETRA Chat | 880x760 | 132,813 |
| `05-netra-chat-600x760.png` | 05 NETRA Chat | 600x760 | 111,993 |
| `05-netra-chat-375x760.png` | 05 NETRA Chat | 375x760 | 64,935 |
| `06-ne0-index-log-1180x760.png` | 06 Ne0 Index Log | 1180x760 | 159,139 |
| `07-ne0-index-feed-1180x760.png` | 07 Ne0 Index Feed | 1180x760 | 175,195 |
| `08-nex-contact-sheet-1180x760.png` | 08 NeX Contact Sheet | 1180x760 | 125,349 |
| `09-nex-index-board-1180x760.png` | 09 NeX Index Board | 1180x760 | 130,108 |
| `10-boot-calibration-1180x760.png` | 10 Boot · Calibration | 1180x760 | 174,456 |
| `11-boot-scrubber-1180x760.png` | 11 Boot · Scrubber | 1180x760 | 133,590 |
| `12-return-bookmark-1180x760.png` | 12 Return · Bookmark | 1180x760 | 183,941 |
| `13-return-revisit-1180x760.png` | 13 Return · Revisit | 1180x760 | 169,103 |

## Notes for Betelgeuse

- All screenshots are first-frame PNG only (no animated frames; CSS animations at t=0+800ms settle)
- Responsive PNGs capture the full stage element at the given viewport width — the design was built at 1180px fixed; the responsive captures show how content clips/overflows below that width
- The NETRA reticle pulse animation (`@keyframes netra-pulse`) is captured at first visible frame — you will see the reticle but not the mid-pulse fade
- Font loading: Google Fonts CDN was available at capture time; Cormorant Garamond, JetBrains Mono, Special Elite, and Noto Serif Thai should all be present
- Two 404 errors logged during capture (internal omelette/design-tool endpoints) — these do not affect the rendered output; the 404s are design-tool telemetry, not font or component assets

---

*canopus · α-HRN-07 · 2026-05-14 · TASK-2026-05-14-06 S1*
