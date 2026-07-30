/**
 * components/netra/useNetraChat.ts — S8 streaming client for NetraBay's
 * `ask()` seam (NetraBay.tsx ~line 122, per the redesign plan's exact seam
 * contract: swap the `askOffline()` call, keep the `{ ms, count, answer }`
 * shape so the surrounding turn-patch/commit/announce code doesn't change).
 *
 * Modeled after netra-bay-local.ts's module-level store pattern: this hook
 * does NOT hold the transcript in React state. It patches the *existing*
 * pending turn (already pushed by NetraBay.tsx before calling `streamAsk`)
 * in place via `setNetraLog`/`getNetraLogSnapshot`, the same plain functions
 * NetraBay itself uses — safe to call from here because they are module
 * state, not hooks.
 *
 * Parsing approach (verified against installed node_modules/ai@6.0.218,
 * not training data): `/api/chat` returns an AI SDK v6 UI-message SSE
 * stream (see app/api/chat/route.ts's `toUIMessageStreamResponse()`).
 * `readUIMessageStream` (from 'ai') is client-usable — no `server-only`
 * guard on it — but it consumes a `ReadableStream<UIMessageChunk>`, not raw
 * SSE bytes. `ai`'s own `DefaultChatTransport.processResponseStream`
 * (node_modules/ai/dist/index.mjs, `src/ui/default-chat-transport.ts`) shows
 * the exact bridge: `parseJsonEventStream({ stream, schema:
 * uiMessageChunkSchema })` (also from 'ai', re-exported from
 * `@ai-sdk/provider-utils`) turns the SSE `Uint8Array` body into a stream of
 * `ParseResult<UIMessageChunk>`, unwrapped via a `TransformStream` that
 * throws on a parse failure. This file reproduces that exact bridge rather
 * than inventing a manual SSE parser, since it is the SDK's own supported
 * path for a client that isn't using `useChat`.
 *
 * Fallback matrix (all four branches return `{ ms, count, answer, local }`,
 * never throw — `ask()` in NetraBay.tsx can `await` unconditionally):
 *   - fetch rejects (network down) / non-2xx that isn't 429 (incl. 503 when
 *     AI_GATEWAY_API_KEY is unset, 500, 400) → `askOffline()`, `local: true`
 *   - no first stream chunk within 6s → abort via `AbortController`, same
 *     `askOffline()` fallback
 *   - 429 → push a dormancy notice turn (DORMANCY.instrument scope line,
 *     DORMANCY.companionEn body — the exact companion-register strings from
 *     lib/netra/constants.ts, never paraphrased) ahead of the pending turn,
 *     remember `Retry-After` as a cooldown window, then answer locally;
 *     every ask before the window elapses skips the network entirely and
 *     answers locally too (no repeated dormancy notices)
 *   - otherwise → live: progressively patches the pending turn's tool-call
 *     line (`tool-input-available`) and result line (`tool-output-available`)
 *     as real events arrive, grows `turn.a` on every text delta, and returns
 *     the finished `{ ms, count, answer, local: false }` once the stream ends
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getToolName,
  isToolUIPart,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { DORMANCY } from "@/lib/netra/constants";
import { askOffline, getNetraLogSnapshot, setNetraLog, type NetraTurn } from "./netra-bay-local";

const CHAT_ENDPOINT = "/api/chat";
/** No first stream event within this window ⟶ abort and fall back local. */
const FIRST_EVENT_TIMEOUT_MS = 6000;
/** "last 6 answered Q/A pairs" per the S8 task contract. */
const HISTORY_PAIRS = 6;
/** Retry-After fallback if the header is missing/unparseable — matches the route's 429 window being measured in seconds. */
const DEFAULT_RETRY_SECONDS = 60;

export interface StreamAskResult {
  ms: number;
  count: number;
  answer: string;
  /** true when this answer came from the offline keyword fallback, not a live model turn. */
  local: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildHistory(): ChatMessage[] {
  const { log } = getNetraLogSnapshot();
  const answered = log.filter((t): t is NetraTurn & { q: string; a: string } => t.q !== null && t.a !== null);
  const pairs: ChatMessage[] = [];
  for (const turn of answered.slice(-HISTORY_PAIRS)) {
    pairs.push({ role: "user", content: turn.q }, { role: "assistant", content: turn.a });
  }
  return pairs;
}

/** Inserts a dormancy notice turn immediately before `uid`'s pending turn. */
function pushDormancyNotice(uid: string, retrySeconds: number): void {
  const snapshot = getNetraLogSnapshot();
  const idx = snapshot.log.findIndex((t) => t.uid === uid);
  const notice: NetraTurn = {
    uid: crypto.randomUUID(),
    q: null,
    scope: DORMANCY.instrument,
    fn: `cooldown(${retrySeconds}s)`,
    result: "dormant · answering locally until reset",
    a: DORMANCY.companionEn,
  };
  const nextLog =
    idx === -1 ? [...snapshot.log, notice] : [...snapshot.log.slice(0, idx), notice, ...snapshot.log.slice(idx)];
  setNetraLog({ log: nextLog, target: snapshot.target });
}

function formatToolInput(input: unknown): string {
  try {
    const json = JSON.stringify(input) ?? "";
    return json.length > 60 ? `${json.slice(0, 60)}…` : json;
  } catch {
    return "";
  }
}

/**
 * Patches `uid`'s pending turn in place from the live-streamed message's
 * current parts: the tool-call two-line block (`fn`/`result`) and the
 * growing answer text (`a`). Called on every `readUIMessageStream` tick, so
 * each patch only needs to set what's newly known — no-op fields are simply
 * omitted from the merge.
 */
function applyLiveMessage(uid: string, message: UIMessage, elapsedMs: () => number, onCount: (n: number) => void): void {
  const patch: Partial<NetraTurn> = {};

  const toolParts = message.parts.filter(isToolUIPart);
  const lastTool = toolParts[toolParts.length - 1];
  if (lastTool) {
    const toolName = getToolName(lastTool);
    const state = (lastTool as { state?: string }).state;
    if (state === "input-available" || state === "output-available") {
      const input = (lastTool as { input?: unknown }).input;
      patch.fn = `${toolName}(${formatToolInput(input)})`;
    }
    if (state === "output-available") {
      const output = (lastTool as { output?: unknown }).output as
        | { count?: number; ms?: number; id?: string }
        | undefined;
      if (output && typeof output.count === "number") {
        const ms = typeof output.ms === "number" ? output.ms : elapsedMs();
        patch.result = `resolved · ${String(output.count).padStart(2, "0")} entries · ${ms}ms`;
        onCount(output.count);
      } else if (output && typeof output.id === "string") {
        // inspect_surface has no count/ms field — one surface, honest elapsed ms.
        patch.result = `resolved · 01 entries · ${elapsedMs()}ms`;
        onCount(1);
      }
    }
  }

  const text = message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
  if (text) patch.a = text;

  if (Object.keys(patch).length === 0) return;

  const snapshot = getNetraLogSnapshot();
  const nextLog = snapshot.log.map((t) => (t.uid === uid ? { ...t, ...patch } : t));
  setNetraLog({ log: nextLog, target: snapshot.target });
}

export function useNetraChat() {
  const abortRef = useRef<AbortController | null>(null);
  const dormantUntilRef = useRef<number>(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const streamAsk = useCallback(async (uid: string, query: string, targetId: string | null): Promise<StreamAskResult> => {
    if (Date.now() < dormantUntilRef.current) {
      return { ...askOffline(query), local: true };
    }

    const messages: ChatMessage[] = [...buildHistory(), { role: "user", content: query }];

    const controller = new AbortController();
    abortRef.current = controller;
    let firstChunkSeen = false;
    const timeoutId = window.setTimeout(() => {
      if (!firstChunkSeen) controller.abort();
    }, FIRST_EVENT_TIMEOUT_MS);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, target: targetId }),
        signal: controller.signal,
      });

      const remainingHeader = response.headers.get("X-NETRA-Remaining");
      if (remainingHeader !== null && !Number.isNaN(Number(remainingHeader))) {
        setRemaining(Number(remainingHeader));
      }

      if (response.status === 429) {
        const retrySeconds = Number(response.headers.get("Retry-After")) || DEFAULT_RETRY_SECONDS;
        dormantUntilRef.current = Date.now() + retrySeconds * 1000;
        pushDormancyNotice(uid, retrySeconds);
        return { ...askOffline(query), local: true };
      }

      if (!response.ok || !response.body) {
        // Includes 503 UPSTREAM_UNAVAILABLE (no AI_GATEWAY_API_KEY — the
        // live behavior of this worktree today), 500, and 400.
        return { ...askOffline(query), local: true };
      }

      const chunkStream = parseJsonEventStream({
        stream: response.body,
        schema: uiMessageChunkSchema,
      }).pipeThrough(
        new TransformStream<{ success: boolean; value?: UIMessageChunk; error?: unknown }, UIMessageChunk>({
          transform(chunk, ctrl) {
            if (!chunk.success) throw chunk.error;
            ctrl.enqueue(chunk.value as UIMessageChunk);
          },
        })
      );

      const t0 = performance.now();
      const elapsedMs = () => Math.max(1, Math.round(performance.now() - t0));
      let lastText = "";
      let finalCount = 0;

      for await (const message of readUIMessageStream({ stream: chunkStream })) {
        firstChunkSeen = true;
        window.clearTimeout(timeoutId);
        applyLiveMessage(uid, message, elapsedMs, (n) => {
          finalCount = n;
        });
        lastText = message.parts
          .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("");
      }

      if (!lastText) {
        // Stream closed with no text — treat as an upstream failure, not a
        // silent empty reply.
        return { ...askOffline(query), local: true };
      }

      return { ms: elapsedMs(), count: finalCount, answer: lastText, local: false };
    } catch {
      return { ...askOffline(query), local: true };
    } finally {
      window.clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  return { streamAsk, remaining, abort };
}
