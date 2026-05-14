# RENDERING — the team's rendering capability map

> Single discoverable source for all browser/render tools available to every agent.
> Written by Canopus (α-HRN-07) · TASK-2026-05-14-07 · 2026-05-14

---

## Rule of thumb

**If your answer changes between the first frame and t=N seconds — use Path B.**

Path A captures a single frozen frame. Path B keeps a live browser session open
so you can scroll, hover, trigger motion, wait for streaming responses, run
Lighthouse, and read the final DOM state. Use A for static layout checks; use B
for anything time- or interaction-dependent.

---

## Path A · Static rendering · `scripts/render-html.sh`

Installed by TASK-2026-05-14-06 (Canopus). Takes a local HTML file, spins up a
temporary HTTP server, loads it in headless Chromium via Playwright, and writes
a PNG.

### What it does

- Loads the HTML via an ephemeral `python3 -m http.server` (avoids CORS/XHR
  restrictions on `file://`)
- Waits for `networkidle` + a 800ms settle delay (first CSS animation keyframe)
- Optionally clips to a named `.stage[data-screen-label="…"]` element
- No interactivity, no scroll, no clicks — first frame only
- Idempotent: re-running the same args produces the same output

### When to use A

- Diff checking: "did the layout change after my edit?"
- Quick evidence for a handoff: "here is what the page looks like now"
- Content audits that only need a static snapshot (widows, hyphenation, color)

### Argument shape

```bash
bash scripts/render-html.sh <html-path> <out-png-path> [WxH] [--stage <label>]

# Full viewport, default 1180x760:
bash scripts/render-html.sh source/Worldline.html out/full.png

# Specific viewport:
bash scripts/render-html.sh source/Worldline.html out/mobile.png 375x812

# Clip to one stage element:
bash scripts/render-html.sh source/Worldline.html out/stage-home.png 1180x760 --stage home
```

### Requirements

- Node v18+, Python 3
- Playwright Chromium: `npx playwright@latest install chromium`
- Or set `PLAYWRIGHT_NODE_MODULES` to a directory containing `playwright/`

---

## Path A' · Bundle fetcher · `scripts/fetch-design-bundle.sh`

Installed by TASK-2026-05-14-07 (Canopus). Downloads a gzip-tar design bundle
from a Peat-authorized URL, extracts it, and prints a manifest of extracted
files to stdout. Use this when Peat shares a new bundle URL (e.g., an Anthropic
design tool export) and you need to materialize it locally before Path A can
render it.

### What it does

- Downloads the bundle with `curl` to a temp file (cleaned on exit)
- Sniffs whether it is a gzip-tar archive or a bare gzip file
- Extracts into `<output_dir>` (tar-xzf or gunzip as appropriate)
- Refuses to overwrite a non-empty `<output_dir>` without `--overwrite`
- Prints a per-file manifest to stdout

### Authorization model

This script makes an outbound HTTP request. It does NOT enforce any URL
allowlist. The caller must verify that Peat has explicitly authorized the URL
for the current task before invoking this script.

Currently Peat-authorized domains:
- `localhost` / `127.0.0.1` (any port) — always free for local dev bundles
- `api.anthropic.com` — authorized by Peat in TASK-2026-05-14-06

To widen for a new task: record the Peat-authorization in the task handoff, then
note the domain here with a dated entry. Do not fetch from new domains without
task-level authorization.

### Argument shape

```bash
bash scripts/fetch-design-bundle.sh <bundle_url> <output_dir> [--overwrite]

# Extract a new bundle:
bash scripts/fetch-design-bundle.sh \
  "https://api.anthropic.com/v1/design/h/...?open_file=Worldline.html" \
  source/

# Re-extract into a non-empty dir:
bash scripts/fetch-design-bundle.sh \
  "https://api.anthropic.com/v1/design/h/...?open_file=Worldline.html" \
  source/ --overwrite
```

### Requirements

- `curl`, `file`, `gzip`, `tar`

---

## Path B · Interactive browser · MCP server

Installed by TASK-2026-05-14-07 (Canopus). A persistent browser session wired
into every subagent via the project-scoped `.mcp.json`.

### MCP server

- **Package:** `@playwright/mcp`
- **Version:** `0.0.75` (pinned in `package.json` as a devDependency)
- **Source:** `github.com/microsoft/playwright-mcp` (Microsoft / official Playwright team)
- **Wired via:** `.mcp.json` at project root + `enabledMcpjsonServers: ["playwright"]` in `.claude/settings.json`
- **Mode:** headless Chromium by default (no GUI)

### Why this package

Three packages were evaluated:

| Package | Maintainer | Tool coverage | Notes |
|---|---|---|---|
| `@playwright/mcp` v0.0.75 | Microsoft / Playwright team | Full (20+ tools) | Official; highest maintenance confidence; MIT |
| `@automatalabs/mcp-server-playwright` v1.2.1 | Community | Subset | Fewer tools; narrower maintenance surface |
| `@modelcontextprotocol/server-playwright` v0.0.19 | Community | Subset | Minimal; not actively maintained |

`@playwright/mcp` is the clear choice: official maintainer, broadest tool surface, matches the Playwright version already used in `render-html.sh`.

### Tool surface (v0.0.75)

Core tools every agent will use:

| Tool | What it does |
|---|---|
| `browser_navigate` | Load a URL in the current tab |
| `browser_snapshot` | Return the accessibility tree of the current page (primary action input) |
| `browser_take_screenshot` | Take a PNG screenshot of the current page |
| `browser_evaluate` | Run arbitrary JavaScript in the page context and return the result |
| `browser_console_messages` | Return all console messages (error/warn/info/debug) since page load |
| `browser_click` | Click an element identified from the accessibility snapshot |
| `browser_hover` | Hover over an element |
| `browser_fill_form` | Fill a form field |
| `browser_type` | Type text at the current cursor position |
| `browser_press_key` | Press a keyboard key |
| `browser_scroll` | Scroll the page or an element |
| `browser_drag` / `browser_drop` | Drag-and-drop |
| `browser_wait_for` | Wait until a selector or text appears |
| `browser_navigate_back` | Go back in history |
| `browser_network_requests` | List all network requests since page load |
| `browser_network_request` | Get full headers+body for one request by index |
| `browser_resize` | Resize the browser viewport |
| `browser_handle_dialog` | Accept/dismiss alert, confirm, or prompt dialogs |
| `browser_close` | Close the current browser tab |
| `browser_tabs` | List open tabs and switch between them |

Storage and state tools (use sparingly; no auth-bearing sessions):

- `browser_cookie_*`, `browser_localstorage_*`, `browser_sessionstorage_*`,
  `browser_set_storage_state`, `browser_storage_state`

Advanced tools (require `--caps devtools` to unlock):

- `browser_run_code_unsafe` — run arbitrary code with Node.js access
- `browser_network_state_set`, `browser_route`, `browser_route_list`,
  `browser_unroute` — network interception

### When to use B

- Motion/animation needs to play to a target frame before you can judge it
- Hover states, focus rings, scroll-bound effects
- Live streaming (NETRA chat SSE, tool calls in progress)
- Lighthouse / a11y audit (navigate → run audit script via `browser_evaluate`)
- Responsive layout at real breakpoints (use `browser_resize`)
- DOM state after hydration has completed
- Any scenario where "first frame" is not the final answer

### Security scope

The server is invoked with `--allowed-origins`:

```
http://localhost:*;https://localhost:*;https://api.anthropic.com
```

This limits the origins the browser will make requests to. Localhost (any port)
is always allowed for local development. `api.anthropic.com` is included because
Peat authorized it in TASK-2026-05-14-06 for design bundle review.

**To widen for a new task:** get Peat's explicit authorization, record it in the
task handoff, and update the `--allowed-origins` arg in `.mcp.json` with a dated
comment in the task's handoff. Do not widen silently.

Note: `--allowed-origins` is not a hard security boundary (it does not prevent
redirects). The real enforcement is Peat's authorization model — only invoke
`browser_navigate` on URLs Peat has confirmed are in scope for the task.

### Headed mode toggle (debug)

By default the server runs headless — no browser window appears. To watch a
debug run with a visible browser:

1. Temporarily edit `.mcp.json` and remove the `--headless` arg.
2. Start a new Claude Code session (MCP servers are launched at session start).
3. The browser window will appear on Peat's display when agents navigate.
4. Restore `--headless` when done and restart.

Or run the server directly from the CLI to watch a single script:

```bash
node node_modules/@playwright/mcp/cli.js --browser chromium
# (no --headless = headed mode)
```

---

## Per-agent reuse map

| Agent | Primary use | Secondary use |
|---|---|---|
| Sirius | Debug hydration, motion playback, responsive at real breakpoints | His own before/after handoffs |
| Betelgeuse | Review Sirius's live implementations (hover, focus, scroll-bound motion) | Design bundle review (when Path A is not enough) |
| Algol | Lighthouse runs (a11y/perf), keyboard sweep, screen-reader check, visual-diff approval | Regression baselines |
| Vega | Prose-in-layout judgement (widows, hyphenation, Thai-EN mix in context) | Rendered prose snapshots |
| Arcturus | NETRA chat end-to-end (streaming, tool calls, refusal) | Chat-state snapshots for prompt eval |
| Procyon | velite-built content render verification | Photo pipeline output checks |
| Altair | Rare — SSE / chat streaming only | — |
| Polaris | Ad-hoc verification at acceptance | — |

---

## Known limitations and deviations

**Subagent inheritance:** MCP servers declared in `.mcp.json` are loaded by the
root Claude Code session. Whether subagents (dispatched via the `Agent` tool)
inherit the project-scoped MCP depends on the Claude Code version. As of
2026-05-14, project-scoped `.mcp.json` MCP servers are available at the root
session level; subagent inheritance is not guaranteed on all versions.

If a subagent reports that `browser_navigate` is not available:
- The root session confirms the tools by listing its tool inventory.
- Polaris can run a verification from the root session and pass the result as
  an artifact to the subagent.
- As a fallback, the subagent can use Path A (render-html.sh) which does not
  require MCP.

**No Lighthouse integration out of the box:** `@playwright/mcp` does not expose
Lighthouse as a named tool. Algol can approximate it via `browser_evaluate` with
the Lighthouse Node API (needs `lighthouse` npm package). See Algol for a formal
Lighthouse rail when that work is scoped.

---

*end of RENDERING.md*
