/**
 * components/netra/netra-bay-local.ts — pure helpers for NetraBay's
 * offline-first ask/pick path + localStorage persistence.
 *
 * Split out of NetraBay.tsx (component file length smell) — no JSX, no
 * hooks, isomorphic-safe types shared with SurveyTranscript.tsx.
 *
 * `askOffline` is the S8 seam: a streaming client swaps its call site in
 * NetraBay's `ask()` for a real `/api/chat` request, keeping the same
 * `{ ms, count, answer }` shape so the turn-patch logic doesn't change.
 *
 * `NetraLogSnapshot` is a `useSyncExternalStore` store, not a plain getter.
 * This is a deliberate hydration-safety fix (see NetraBay.tsx's comment at
 * its call site): a naive `useEffect(() => setLog(loadStoredLog()), [])`
 * reads localStorage and calls `setState` synchronously inside an effect,
 * which the React Compiler's `react-hooks/set-state-in-effect` rule (part
 * of the `Recommended` preset shipped in this repo's eslint-config-next —
 * see AGENTS.md re: this-is-not-the-Next.js-you-know) flags as an error.
 * `useSyncExternalStore` is the mechanism React ships specifically for
 * "read a value that only exists on the client without a hydration
 * mismatch": SSR and the first client paint both use `getServerSnapshot`
 * (empty), and React itself — not an effect we write — reconciles against
 * `getSnapshot` right after mount. Every subsequent mutation (ask/pick/
 * clear) goes through `commitNetraLog`/`clearNetraLog`, which update the
 * module-level snapshot, persist it, and notify subscribers.
 */

import { ARCHIVE } from "@/lib/netra/archive";
import { NO_TRACE } from "@/lib/netra/constants";
import { scoreArchive } from "@/lib/netra/retrieval";

const STORAGE_KEY = "wl-netra-log-v1";
const MAX_LOG = 40;

export interface NetraTurn {
  uid: string;
  /** null for point-mode picks — those never carry a visitor question. */
  q: string | null;
  scope: string;
  fn: string;
  result: string;
  a: string | null;
}

export interface NetraTarget {
  id: string;
  label: string;
}

export interface NetraLogSnapshot {
  log: NetraTurn[];
  target: NetraTarget | null;
}

const EMPTY_SNAPSHOT: NetraLogSnapshot = { log: [], target: null };

function readStoredLog(): NetraLogSnapshot | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NetraLogSnapshot> | null;
    if (parsed && Array.isArray(parsed.log)) {
      return { log: parsed.log, target: parsed.target ?? null };
    }
  } catch {
    /* corrupt or unavailable storage — start with a fresh log */
  }
  return null;
}

function writeStoredLog(log: NetraTurn[], target: NetraTarget | null): void {
  try {
    const clean = log.filter((t) => t.a).slice(-MAX_LOG);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ log: clean, target }));
  } catch {
    /* storage full or unavailable — paper full, degrade silently */
  }
}

let snapshot = EMPTY_SNAPSHOT;
let hydrated = false;
const listeners = new Set<() => void>();

/**
 * `useSyncExternalStore` client getter. Lazily hydrates from localStorage on
 * the first call only (idempotent thereafter) and returns a stable
 * reference until `commitNetraLog`/`clearNetraLog` change it — safe to call
 * on every render.
 */
export function getNetraLogSnapshot(): NetraLogSnapshot {
  if (!hydrated) {
    hydrated = true;
    const stored = readStoredLog();
    if (stored) snapshot = stored;
  }
  return snapshot;
}

/** `useSyncExternalStore` server getter — SSR and the first client paint agree: empty. */
export function getNetraLogServerSnapshot(): NetraLogSnapshot {
  return EMPTY_SNAPSHOT;
}

export function subscribeNetraLog(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** In-memory-only update — e.g. pushing a pending "borne" turn. No localStorage write (it isn't answered yet), still notifies subscribers so the transcript renders it immediately. */
export function setNetraLog(next: NetraLogSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** The one persisting mutation path — updates the snapshot, persists the answered subset, notifies subscribers. */
export function commitNetraLog(next: NetraLogSnapshot): void {
  snapshot = next;
  writeStoredLog(next.log, next.target);
  listeners.forEach((listener) => listener());
}

/** CLEAR LOG — resets the snapshot and the underlying storage key, notifies subscribers. */
export function clearNetraLog(): void {
  snapshot = EMPTY_SNAPSHOT;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
}

/** Prototype's `retrieve()` + answer-shaping, via the shared `scoreArchive` port. */
export function askOffline(query: string): { ms: number; count: number; answer: string } {
  const t0 = performance.now();
  const hits = scoreArchive(query, ARCHIVE);
  const ms = Math.max(1, Math.round(performance.now() - t0));
  const answer = hits.length
    ? hits[0].node.brief +
      (hits.length > 1 ? ` — ${hits.length - 1} related file${hits.length > 2 ? "s" : ""} nearby.` : "")
    : NO_TRACE;
  return { ms, count: hits.length, answer };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return /^(input|textarea|select)$/i.test(el.tagName);
}
