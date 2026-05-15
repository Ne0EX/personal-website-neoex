# TO · Polaris
# FROM · Canopus
# TASK · TASK-2026-05-15-push-notify
# TYPE · BLOCKER
# CREATED · 2026-05-15T00:00:00Z

---

## scope

Peat (via Polaris) requested push notifications to his mobile when task sessions complete
and when subagents finish. This handoff reports a hard blocker discovered during mandatory
pre-implementation verification: the built-in `PushNotification` tool cannot deliver to
Peat's mobile under current conditions. No hook was written. Polaris must decide on an
alternative channel before Canopus can implement.

## what i did

1. Read `.claude/settings.json` to confirm the existing Stop hook structure and its
   `$CLAUDE_TASK_ID` guard.
2. Read `.claude/hooks/sign-work.sh`, `.claude/hooks/README.md`, and
   `docs/harness/RAIL-DEFINITIONS.md` to understand the full hook surface before touching
   anything.
3. Fetched the `PushNotification` tool schema via ToolSearch to understand its contract.
4. Read the schema description carefully. Key clause: "If Remote Control is connected, it
   also pushes to their phone." The word "also" and "if" indicate mobile is conditional,
   not guaranteed.
5. Ran a live test invocation:

   ```
   PushNotification(message="canopus verification probe — ignore this notification
   (task TASK-2026-05-15-push-verify)", status="proactive")
   ```

   Result returned by the tool: **"Mobile push not sent (Remote Control inactive)."**

6. Concluded: mobile delivery is blocked. The tool is operational for desktop terminal
   delivery only. No hook was written. Per task instructions: stop and handoff.

## what i did NOT do (in scope but parked)

- SubagentStop hook — WAIT(Polaris: channel decision)
- Stop hook notification extension — WAIT(Polaris: channel decision)
- settings.json wiring — WAIT(Polaris: channel decision)
- RAIL-DEFINITIONS.md notification rail entry — WAIT(Polaris: channel decision)
- Signature for this task — not applicable (no files touched; sign-work exits 3 on
  no changed files, which is correct here)

## what you do next

Decision required from Polaris (relay to Peat if needed): pick a notification channel
from the alternatives below, or confirm that Remote Control is now active and Canopus
should retest.

**Option A — Activate Remote Control (preferred if available)**
Peat links his mobile to claude.ai Remote Control (Anthropic mobile app feature). Once
linked, the built-in `PushNotification` tool delivers to his phone. Canopus then
implements the hooks with zero external dependencies. Steps for Peat:
- Open the Claude.ai app on mobile
- Enable Remote Control / Connect device in Settings
- Confirm activation to Canopus (or have Polaris relay); Canopus re-runs the probe and
  proceeds to hook implementation if the result changes from "inactive"

**Option B — Webhook to a third-party push service**
Canopus writes a `notify.sh` wrapper that POSTs to one of:
- **ntfy.sh** (open-source; self-hostable; Peat subscribes via the ntfy mobile app; no
  account required for the public server; topic is effectively a shared secret)
- **Pushover** (requires a $5 one-time Pushover account + device registration; gives
  reliable iOS/Android delivery with priority levels)
- **Telegram bot** (Canopus writes hook that POSTs to a bot token; Peat subscribes to
  the bot; free)

For any webhook option, Peat must supply a credential (ntfy topic, Pushover user/app key,
Telegram bot token + chat ID). These go in `.claude/settings.json` as a
`notification_webhook` env var or in a `.env.local` that is .gitignored. Canopus handles
the hook plumbing; Peat handles account setup.

**Option C — Vercel-hosted notification endpoint**
Arcturus (α-NET-05) builds a small Vercel function that accepts a POST from the hook and
fans out to whatever channel Peat prefers (email, SMS via Twilio, etc.). This is the most
infrastructure-heavy option. Canopus wires the hook; Arcturus owns the endpoint.

**Option D — Desktop only (no mobile)**
Accept that `PushNotification` fires on desktop (terminal) only. If Peat's laptop screen
is visible, he'll see the notification. No mobile delivery. Simplest — already works,
nothing to build.

## inputs you'll need

- Peat's channel preference (A/B/C/D above)
- If B: credentials for chosen push service
- If C: Arcturus task assignment to build the endpoint

## acceptance criteria for the recipient's work

Polaris returns one of:
1. "Remote Control confirmed active — retest and proceed" → Canopus retests probe,
   implements hooks if result changes
2. "Use Option B: [service] — credentials at [location]" → Canopus implements
   `notify.sh` + SubagentStop hook + Stop hook extension + settings.json wiring
3. "Use Option C" → Polaris assigns Arcturus the endpoint task in parallel; Canopus
   waits for endpoint URL then implements hooks
4. "Option D — desktop only is fine" → Canopus closes this as no-op; no new hooks needed

## known deviations

None. Task instructions said "STOP and write a handoff" on failed verification. That is
exactly what happened.

## risks i'm aware of

- Remote Control activation on Peat's side may require an Anthropic app version update.
  The probe result wording ("Remote Control inactive") suggests it is a known state the
  tool tracks, so retest after activation should be straightforward.
- Webhook options introduce a secret (token/key) that must not be committed to the repo.
  `.gitignore` discipline is required; Canopus will enforce this in the hook implementation.
- ntfy.sh public server topics are not truly private (anyone who knows the topic name can
  subscribe). For Peat's use case (task progress, not sensitive data) this is acceptable
  risk, but worth flagging.

## handoff cc

none

---

## signature

No signature file — no files touched. sign-work.sh correctly exits 3 ("no changed files
attributed to this task") in this case. This handoff is self-describing: the only action
taken was the verification probe (a tool call, not a file write). Algol should treat
TASK-2026-05-15-push-notify as a zero-file investigation task.

---

*end of handoff*
