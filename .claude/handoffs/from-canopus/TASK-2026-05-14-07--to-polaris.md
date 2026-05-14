---
task_id: TASK-2026-05-14-07
from: canopus · α-HRN-07
to: polaris · α-OPS-00
date: 2026-05-14
status: complete
---

# TASK-2026-05-14-07 return handoff — canopus → polaris

## scope

Path B browser capability: `@playwright/mcp` MCP server wired project-scoped,
`scripts/fetch-design-bundle.sh` generalized, `docs/harness/RENDERING.md`
written as single discoverable source. All four acceptance items delivered.

---

## what I did

### S1 · MCP server selection + install + wire

Evaluated three candidates:

| Package | Maintainer | Decision |
|---|---|---|
| `@playwright/mcp` v0.0.75 | Microsoft / Playwright team | CHOSEN |
| `@automatalabs/mcp-server-playwright` v1.2.1 | Community | Narrower tool surface |
| `@modelcontextprotocol/server-playwright` v0.0.19 | Community | Inactive; minimal |

`@playwright/mcp` is official Microsoft/Playwright — same team as the Playwright
dependency already in use for `render-html.sh`. Tool surface is the largest (20+
tools including navigate, snapshot, screenshot, evaluate, console, click, hover,
scroll, resize, network inspection, keyboard).

Installed as devDependency: `npm install --save-dev @playwright/mcp@0.0.75`

MCP wiring: Claude Code project-scoped MCP lives in `.mcp.json` at the project
root (not inside `.claude/settings.json` — that schema does not carry `mcpServers`).

Files modified/created:
- `.mcp.json` — new, defines `playwright` MCP server with `--headless --browser chromium --allowed-origins http://localhost:*;https://localhost:*;https://api.anthropic.com`
- `.claude/settings.json` — added `"enabledMcpjsonServers": ["playwright"]` to auto-approve the project server; all four hooks blocks preserved

Smoke test (run from repo root, confirms binary is functional):
```bash
node node_modules/@playwright/mcp/cli.js --help
```
Exits 0, displays help including all flags. Binary is at
`node_modules/@playwright/mcp/cli.js` (the `playwright-mcp` binary in `.bin/`
also works).

### S2 · scripts/fetch-design-bundle.sh

New script at `scripts/fetch-design-bundle.sh`, mode 755, `bash -n` clean.

Behavior:
- Requires: `curl`, `file`, `gzip`, `tar`
- Guards against overwriting a non-empty output dir without `--overwrite`
- Sniffs MIME type + tries `tar -tzf` to distinguish gzip-tar from bare gzip
- gzip-tar → `tar -xzf` extract
- bare gzip → `gunzip -c` decompress, naming output from URL basename
- Unknown type → copy as-is with warning
- Prints file manifest to stdout after extraction
- Authorization model documented in script header (not enforced in code;
  caller is responsible for Peat confirmation)

FILE-OWNERSHIP.md updated: `scripts/fetch-design-bundle.sh` added to Canopus
block under `scripts/visual-capture.sh` (same territory, Polaris-sanctioned per
TASK contract S2).

### S3 · docs/harness/RENDERING.md

New file at `docs/harness/RENDERING.md`.

Covers:
- Path A (render-html.sh) — what, when, argument shape, examples
- Path A' (fetch-design-bundle.sh) — what, authorization model, examples
- Path B (@playwright/mcp) — MCP choice rationale, pinned version, full tool
  surface table, when-to-use-B rule, security scope
- Per-agent reuse map (exact table from TASK contract)
- Security note on Peat-authorization model
- Headed mode toggle instructions

### S4 · ESLint fix (incidental)

Post-edit lint revealed `.claude/visual-diffs/TASK-2026-05-14-06/source/babel.min.js`
was being scanned (minified vendor JS from the TASK-06 bundle extraction). Added
`.claude/visual-diffs/**` to `eslint.config.mjs` globalIgnores — same class of
fix as the `.claude/worktrees/**` ignore added in TASK-05. Lint now passes clean.

---

## what you do next

1. Run acceptance verification:
   - `cat .claude/settings.json | python3 -m json.tool` — confirm valid JSON + hooks intact
   - `ls -l scripts/fetch-design-bundle.sh` — confirm mode 755
   - `bash -n scripts/fetch-design-bundle.sh` — confirm syntax clean
   - `ls docs/harness/RENDERING.md` — confirm file exists
   - `cat .claude/signatures/TASK-2026-05-14-07--canopus.json | python3 -m json.tool` — confirm v2, both gates true, next_recipient Polaris
   - Run an Edit to confirm TASK-05 fix still holds (no deadlock)

2. Smoke test for browser MCP:
   The tool appears in the root session's tool inventory as `mcp__playwright__browser_navigate`, etc. You can confirm by checking the system-reminder tool list in your next response.
   
   For a stronger test, start the server directly:
   ```bash
   # Send an MCP initialize request via stdio (should respond with capabilities):
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' | \
     node node_modules/@playwright/mcp/cli.js --headless --browser chromium \
     --allowed-origins "http://localhost:*;https://localhost:*" 2>/dev/null | head -1
   ```
   Should return a JSON `result` with `serverInfo.name = "Playwright"` and a
   `capabilities` block.

3. Subagent inheritance note (documented in RENDERING.md §Known limitations):
   Project-scoped `.mcp.json` MCP servers load at the root session. Whether
   subagents dispatched via the `Agent` tool inherit them depends on the Claude
   Code version. If a subagent reports `browser_navigate` unavailable, the root
   session can verify and pass browser output as an artifact, or the subagent
   falls back to Path A. No blocking issue — documented deviation.

4. Close TASK-07 in STATUS.md and include the self_hash from the signature.

5. When ready, commit the rendering-capability wave: TASK-06 + TASK-07 together
   per STATUS.md note ("single commit that closes the rendering-capability wave").

---

## known deviations

1. **files_touched includes carry-overs.** The baseline was deleted (pre-task ran
   after edits, so all task files were recorded as carry-overs). sign-work fell
   back to full git diff — 39 files listed, most are prior-task carry-overs. The
   actual files touched by TASK-07 are:
   - `.claude/settings.json`
   - `.mcp.json` (new)
   - `scripts/fetch-design-bundle.sh` (new)
   - `docs/harness/RENDERING.md` (new)
   - `docs/team/FILE-OWNERSHIP.md` (Polaris-sanctioned per task contract)
   - `eslint.config.mjs` (incidental lint fix)
   - `package.json` / `package-lock.json` (from `npm install @playwright/mcp`)

2. **FILE-OWNERSHIP.md edit.** This is Polaris's file. The edit is a one-line
   addition of `scripts/fetch-design-bundle.sh` to Canopus's territory block,
   explicitly authorized by the TASK contract S2 ("Updated FILE-OWNERSHIP.md if
   scripts/ ownership needs to be made explicit"). No prose ownership changes.

3. **Subagent MCP inheritance not confirmed.** `.mcp.json` is loaded by the root
   session. Subagent inheritance depends on Claude Code version. Documented in
   RENDERING.md §Known limitations with workaround.

---

## signature

`.claude/signatures/TASK-2026-05-14-07--canopus.json`

```
schema_version : 2
agent          : Canopus (α-HRN-07)
harness_passed : true
post_edit_passed: true
self_hash      : 7116758c4e8da9cb782ac0268e3052569c03880547cc5f69c63a59671c85bb56
next_recipient : Polaris (α-OPS-00)
```

---

*canopus · α-HRN-07 · 2026-05-14*
