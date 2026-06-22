"use client";

/**
 * TriangulateSearch.tsx — client component
 * ─────────────────────────────────────────────────────────────────────────────
 * The Triangulate Search overlay: full-archive cross-stratum retrieval
 * instrument. Consumes the pagefind index built at `npm run build`.
 *
 * Design spec:  docs/design/14-triangulate-search.md (Betelgeuse · α-VIS-04)
 * Vision lock:  docs/team/VISION-2026-05-31-search-lineage-console.md §1.1
 *
 * Atoms composed (Rule 5 — compose FROM atoms, never re-derive):
 *   corner-reticle   — header TL micro bracket (.corner-marks on overlay frame)
 *   dashed-hairline  — all section seams (1px dashed var(--ink-dashed))
 *   attractor-pill   — kind chips + facet chips (inline af-pill pattern)
 *   type-roles       — Cormorant italic (voice/title) · JetBrains Mono (instrument)
 *                    · Special Elite (value/coords)
 *   focus-button     — sort toggle (.atlas-strata-btn with is-active variant)
 *   paper-canvas     — overlay panel surface texture
 *
 * Layout (≥881px): two-panel — results left + mini-globe right (fixed 380px).
 * Layout (601–880px): results fill; globe reduces to 240px.
 * Layout (≤600px): 100vw 100dvh single-column; results then globe below.
 *
 * Keyboard nav:
 *   ↑↓ — navigate result rows (sets keyboardIndex)
 *   ↵  — open selected result
 *   ⇥  — cycles: input → kind chips → facet chips → sort → results → input
 *   ESC — if q.bar non-empty: clear; if empty: close (handled by portal)
 *
 * prefers-reduced-motion: all transitions 0ms; globe auto-rotate stopped.
 *
 * pagefind client API (loaded dynamically from /pagefind/pagefind.js):
 *   pagefind.search(query, { filters, sort })
 *   result.data() → { url, meta, excerpt, filters, anchors }
 *
 * Owner: Sirius (α-SUR-01) · S4 Triangulate Search (VISION-2026-05-31)
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArchiveMiniGlobe } from "./ArchiveMiniGlobe";
import type { MiniGlobeReadout } from "./ArchiveMiniGlobe";
import { ArchiveGlobeReadout } from "./ArchiveGlobeReadout";
import { canonicalPath } from "@/lib/client-state/usePagefind";
import type { MiniGlobePin } from "@/lib/content";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type KindFilter = "ALL" | "ARTICLE" | "PHOTO" | "FICTION";
type SortDir = "NEWEST" | "OLDEST";

interface PagefindResult {
  url: string;
  meta: {
    title?: string;
    /** pagefind-meta: kind — article | photo | fiction */
    kind?: string;
    /** pagefind-meta: fileNum — e.g. "001" */
    fileNum?: string;
    /** pagefind-meta: date — YYYY.MM.DD */
    date?: string;
    /** pagefind-meta: isoDate — YYYY-MM-DD (for sort) */
    isoDate?: string;
    /** pagefind-meta: tags — comma-separated */
    tags?: string;
    /** pagefind-meta: coord — "lat°N · lon°E" or blank */
    coord?: string;
    /** pagefind-meta: place — locality label for the readout RETICLE meta */
    place?: string;
    /** pagefind-meta: drift — "N.Nk" distance from α locus */
    drift?: string;
    /** pagefind-meta: tended-count — number of revisions */
    "tended-count"?: string;
    /** pagefind-meta: tended-last — YYYY.MM.DD of last revision */
    "tended-last"?: string;
  };
  excerpt: string;
}

interface SearchState {
  phase: "idle" | "loading" | "results" | "empty" | "failure";
  items: PagefindResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PagefindResult → MiniGlobePin conversion
// The pagefind `coord` meta is a display string: "13.76°N · 100.50°E".
// We parse it here so the globe receives typed numeric coords.
// Results without a coord string are omitted (they have no locus to plot).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the pagefind coord meta string ("13.76°N · 100.50°E") into a
 * { lat, lon } pair. Returns null if the string is absent or malformed.
 *
 * Format contract (ArticleEntry.tsx L85–86, PhotoEntry.tsx):
 *   `${lat.toFixed(2)}°N · ${lon.toFixed(2)}°E`
 */
function parseCoordString(
  coord: string | undefined,
): { lat: number; lon: number } | null {
  if (!coord) return null;
  // Match: optional minus, digits, optional decimal, °N (or °S), separator, same for lon
  const m = coord.match(
    /^(-?[\d.]+)°([NS])\s*·\s*(-?[\d.]+)°([EW])$/i,
  );
  if (!m) return null;
  const lat = parseFloat(m[1]) * (m[2].toUpperCase() === "S" ? -1 : 1);
  const lon = parseFloat(m[3]) * (m[4].toUpperCase() === "W" ? -1 : 1);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

/**
 * Map a PagefindResult[] to MiniGlobePin[].
 * Only results that carry a parseable coord string are included.
 * Privacy gate is already applied upstream (pagefind only indexes entries
 * where the coord meta was written; coords are written only when
 * shareLocation===true in the entry component).
 */
function resultsToPins(results: PagefindResult[]): MiniGlobePin[] {
  const pins: MiniGlobePin[] = [];
  for (const r of results) {
    const coords = parseCoordString(r.meta.coord);
    if (!coords) continue;
    // "photo-roll" maps to the same pin kind as "photo" — roll index pages
    // sit in the photo stratum. Rolls carry no coord today so this path is
    // currently defensive; kept for correctness when coords land.
    const kind: MiniGlobePin["kind"] =
      r.meta.kind === "photo" || r.meta.kind === "photo-roll"
        ? "photo"
        : r.meta.kind === "fiction"
        ? "fiction"
        : "article";
    // id mirrors how getMiniGlobePins() derives stable ids:
    // article → fileNum; photo → fileNum (stored as roll/id); fiction → fileNum (slug).
    const id = r.meta.fileNum ?? r.url;
    pins.push({
      id,
      kind,
      lat: coords.lat,
      lon: coords.lon,
      // Canonicalize at the SOURCE: r.url is a raw pagefind URL ending in .html
      // ("…/DSCF0005.html"). Storing it clean here means every consumer of
      // pin.route — onPinClick's router.push (desktop + mobile) and any future
      // reader — gets the 404-free clean route. Pins from allPins are already
      // clean; this fallback is the only path that injects a raw URL.
      route: canonicalPath(r.url),
      title: r.meta.title ?? "",
      place: r.meta.place ?? "",
    });
  }
  return pins;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kind glyph — mirrors Globe pin taxonomy
// ARTICLE (no prefix) · ▪ PHOTO (U+25AA) · ◆ FICTION (U+25C6)
// ─────────────────────────────────────────────────────────────────────────────

function kindGlyph(kind?: string): string {
  if (kind === "photo" || kind === "photo-roll") return "▪";
  if (kind === "fiction") return "◆";
  return ""; // article — no prefix per spec
}

function kindLabel(kind?: string): string {
  if (kind === "photo" || kind === "photo-roll") return "PHOTO";
  if (kind === "fiction") return "FICTION";
  return "ARTICLE";
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultCard — five-line result row
// ─────────────────────────────────────────────────────────────────────────────

interface ResultCardProps {
  item: PagefindResult;
  isKeySelected: boolean;
  isGlobeActive: boolean;
  isMobile: boolean;
  query: string;
  onHover: (url: string | null) => void;
  reducedMotion: boolean;
}

function ResultCard({
  item,
  isKeySelected,
  isGlobeActive,
  isMobile,
  query,
  onHover,
  reducedMotion,
}: ResultCardProps) {
  const { url, meta } = item;
  // The raw pagefind result url ends in .html ("/articles/001.html") which 404s —
  // the clean route has no suffix. canonicalPath strips .html (+ query/#frag +
  // trailing slash) so the row links to the real route ("/articles/001"). SAME
  // normaliser used for the globe-pin match + hover sync, so the link can't drift
  // from the matching logic. The raw `url` is kept for hover keying (canonicalised
  // at the comparison sites) and the keyboard nav handler canonicalises separately.
  const href = canonicalPath(url);
  const glph = kindGlyph(meta.kind);
  const label = kindLabel(meta.kind);
  const tags = meta.tags
    ? meta.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  // Alive signal: tended N× · last YYYY.MM.DD
  // Omit when count == "1" AND date equals the initial date field
  const tendedCount = parseInt(meta["tended-count"] ?? "1", 10);
  const tendedLast = meta["tended-last"] ?? "";
  const showAlive =
    tendedCount > 1 || (tendedLast && tendedLast !== meta.date);
  const aliveText = showAlive
    ? `tended ${tendedCount}× · last ${tendedLast}`
    : null;

  // Coord line (line 4): mobile = drift only; desktop = full lat/lon + drift
  const coordLine = isMobile
    ? meta.drift
      ? `→ drift ${meta.drift}`
      : null
    : meta.coord
    ? `→ ${meta.coord}${meta.drift ? ` · drift ${meta.drift}` : ""}`
    : meta.drift
    ? `→ drift ${meta.drift}`
    : null;

  // State resolution per spec §ResultCard row states
  let leftBorderColor = "transparent";
  let leftBorderStyle = "solid";
  let leftBorderWidth = "3px";
  let bg = "transparent";
  let outline = "none";

  if (isKeySelected) {
    leftBorderColor = "var(--accent-orange)";
    leftBorderStyle = "solid";
    leftBorderWidth = "3px";
    bg = "var(--paper-warm)";
    outline = "1px solid var(--ink-primary)";
  } else if (isGlobeActive) {
    leftBorderColor = "var(--accent-orange)";
    leftBorderStyle = "solid";
    leftBorderWidth = "3px";
    bg = "var(--paper-warm)";
  }

  const transition = reducedMotion ? "none" : "background 120ms ease, border-color 120ms ease";

  // Highlight query term in title (simple substring, case-insensitive)
  function highlightTitle(title: string): React.ReactNode {
    if (!query.trim()) return title;
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = title.split(re);
    return parts.map((part, i) =>
      re.test(part) ? (
        <mark
          key={i}
          style={{ background: "var(--accent-orange-soft)", color: "inherit" }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  }

  return (
    <li
      role="option"
      aria-selected={isKeySelected}
      onMouseEnter={() => onHover(url)}
      onMouseLeave={() => onHover(null)}
      style={{
        borderBottom: "1px dashed var(--ink-dashed)",
        transition,
        background: bg,
        borderLeft: `${leftBorderWidth} ${leftBorderStyle} ${leftBorderColor}`,
        outline,
        outlineOffset: isKeySelected ? "-1px" : undefined,
        listStyle: "none",
      }}
    >
      <a
        href={href}
        tabIndex={isKeySelected ? 0 : -1}
        style={{
          display: "block",
          padding: "10px 12px",
          textDecoration: "none",
          color: "inherit",
          minHeight: "44px",
        }}
      >
        {/* Line 1: fileNum · date · [glyph] KIND */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            marginBottom: "3px",
          }}
        >
          {meta.fileNum && `${meta.fileNum} · `}
          {meta.date && `${meta.date} · `}
          {glph && `${glph} `}
          {label}
        </div>

        {/* Line 2: title (voice role, Cormorant italic) */}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: "15px",
            letterSpacing: "0.005em",
            color: "var(--ink-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: "3px",
          }}
        >
          {highlightTitle(meta.title ?? "")}
        </div>

        {/* Line 3: tags (max 3, omit if none) */}
        {tags.length > 0 && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.22em",
              color: "var(--ink-faint)",
              marginBottom: "3px",
            }}
          >
            {tags.map((t) => `◇ ${t}`).join(" · ")}
          </div>
        )}

        {/* Line 4: coord + drift (omit if no data) */}
        {coordLine && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.22em",
              color: "var(--ink-soft)",
              marginBottom: aliveText ? "3px" : undefined,
            }}
          >
            {coordLine}
          </div>
        )}

        {/* Line 5: alive signal (omit when N=1 and date=initial) */}
        {aliveText && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.22em",
              color: "var(--ink-faint)",
            }}
          >
            {aliveText}
          </div>
        )}
      </a>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KindChip — radio-role filter chip (kind row)
// ─────────────────────────────────────────────────────────────────────────────

function KindChip({
  label,
  active,
  onClick,
  reducedMotion,
}: {
  label: KindFilter;
  active: boolean;
  onClick: () => void;
  reducedMotion: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        padding: "0.4em 0.75em",
        /* ctl-pill: active = filled-ink (--ctl-pill-bg-active / --ctl-pill-fg-active);
           inactive = transparent + dashed seam (--ctl-pill-border / --ctl-pill-fg). */
        background: active ? "var(--ctl-pill-bg-active)" : "transparent",
        border: `1px solid ${active ? "var(--ctl-pill-border-active)" : "var(--ctl-pill-border)"}`,
        color: active ? "var(--ctl-pill-fg-active)" : "var(--ctl-pill-fg)",
        cursor: "pointer",
        transition: reducedMotion
          ? "none"
          : "background 120ms ease, border-color 120ms ease, color 120ms ease",
        minHeight: "28px",
      }}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SortToggle — ↕ TIME · NEWEST / OLDEST (uses atlas-strata-btn pattern inline)
// ─────────────────────────────────────────────────────────────────────────────

function SortToggle({
  dir,
  onToggle,
  reducedMotion,
}: {
  dir: SortDir;
  onToggle: () => void;
  reducedMotion: boolean;
}) {
  const isDesc = dir === "NEWEST";
  return (
    <button
      type="button"
      aria-pressed={isDesc}
      onClick={onToggle}
      title={`Sort: ${dir} first. Click to toggle.`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        padding: "0.4em 0.75em",
        background: "transparent",
        border: "1px solid var(--ink-dashed)",
        color: "var(--ink-primary)",
        cursor: "pointer",
        minHeight: "28px",
        transition: reducedMotion ? "none" : "border-color 120ms ease",
        whiteSpace: "nowrap",
      }}
    >
      ↕ TIME · {dir}
    </button>
  );
}

// MiniGlobeStub removed — replaced by <ArchiveMiniGlobe size={348} …> per
// docs/design/21-archive-route.md §5.11. The overlay renders the SAME refined
// instrument /archive uses (ArchiveMiniGlobe → ArchiveMiniGlobeThreeJS: drift
// line, teal reticle, unified small markers, α-only orange, free-orbit,
// node-click) + the SAME <ArchiveGlobeReadout> panel, wired the SAME way
// (onReadout / lockedEntryId / onLockChange) — so the two globes share one atom
// and can never drift again (Peat 2026-06-04 consistency port).
// Bidirectional hover: result-row hover sets hoveredUrl → hoveredEntryId prop;
// pin hover calls setHoveredUrl so the matching result row highlights
// (isGlobeActive guard in ResultCard).

// ─────────────────────────────────────────────────────────────────────────────
// TriangulateSearch — main overlay
// ─────────────────────────────────────────────────────────────────────────────

interface TriangulateSearchProps {
  onClose: () => void;
  /**
   * The FULL privacy-gated pin set (getMiniGlobePins over the whole corpus) —
   * the SAME source /archive uses. Result pins are derived by intersecting this
   * with the pagefind result URLs (canonicalPath), so the overlay globe plots the
   * SAME loci /archive plots. This is what keeps the two globes consistent in
   * DATA as well as instrument.
   */
  allPins?: MiniGlobePin[];
}

export function TriangulateSearch({ onClose, allPins = [] }: TriangulateSearchProps) {
  const uid = useId();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLOListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Query state
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [sortDir, setSortDir] = useState<SortDir>("NEWEST");
  const [searchState, setSearchState] = useState<SearchState>({
    phase: "idle",
    items: [],
  });

  // Interaction state
  const [keyboardIndex, setKeyboardIndex] = useState<number>(-1);
  const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // ── Instrument readout + lock — SAME wiring as /archive (ArchiveClient) ──────
  // readout drives the shared <ArchiveGlobeReadout> panel (RETICLE / DRIFT A /
  // BEARING / STRATUM / COORD / α). lockedEntryId is the click-locked node; the
  // globe broadcasts both via onReadout / onLockChange, and the NEXT NODE button
  // cycles the lock here. This is the consistency port — the overlay globe is the
  // SAME refined instrument /archive uses, wired the same way.
  const [readout, setReadout] = useState<MiniGlobeReadout | null>(null);
  const [lockedEntryId, setLockedEntryId] = useState<string | null>(null);
  const jumpIdxRef = useRef(0);

  // pagefind instance — loaded lazily on first search
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagefindRef = useRef<any>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Mini-globe pin derivations — SAME DATA SOURCE as /archive ──────────────
  // CONSISTENCY (Peat 2026-06-04): the overlay globe plots the SAME loci /archive
  // plots. /archive derives pins from getMiniGlobePins(corpus) (server). The
  // overlay receives that exact full pin set as `allPins` and INTERSECTS it with
  // the current pagefind result URLs (canonicalPath, the same normaliser used by
  // usePagefind + ArchiveClient). A result with no public locus (privacy-gated,
  // or no coord) simply contributes no pin — same as /archive.
  //
  // Fallback: any result whose URL is NOT in allPins but DOES carry a parseable
  // coord meta is plotted via resultsToPins (belt-and-suspenders for index/route
  // skew). allPins wins on URL collision so the id/place/title match /archive.
  const { items: searchItems } = searchState;

  const publicLociPins = useMemo(() => {
    const byRoute = new Map<string, MiniGlobePin>();
    for (const p of allPins) byRoute.set(canonicalPath(p.route), p);

    const out: MiniGlobePin[] = [];
    const seen = new Set<string>();
    for (const item of searchItems) {
      const key = canonicalPath(item.url);
      const pin = byRoute.get(key);
      if (pin && !seen.has(key)) {
        out.push(pin);
        seen.add(key);
      }
    }
    // Fallback for results not covered by allPins but carrying coord meta.
    for (const fb of resultsToPins(searchItems)) {
      const key = canonicalPath(fb.route);
      if (!seen.has(key)) {
        out.push(fb);
        seen.add(key);
      }
    }
    return out;
  }, [searchItems, allPins]);

  // Triangulate overlay: no additional filter beyond the search query — all
  // visible results are "in membership". activePins === publicLociPins.
  const matchedPins = publicLociPins;

  // Bidirectional hover: hoveredUrl is the result URL; hoveredEntryId is the
  // pin id (fileNum / roll+id / slug). Derive by matching URL in searchItems.
  // The hover sync is bidirectional:
  //   row hover → setHoveredUrl(item.url) → resolves to hoveredEntryId below
  //   pin hover → onPinHover(pin.id) → resolve pin.route → setHoveredUrl
  const hoveredEntryId = useMemo(() => {
    if (!hoveredUrl) return null;
    // canonicalPath both sides: result URLs carry .html ("…/DSCF0002.html") while
    // pin.route is clean ("…/DSCF0002"). Without normalising, the hover never maps
    // to a pin and the drift-line/reticle/readout stay STANDBY.
    const key = canonicalPath(hoveredUrl);
    const matched = publicLociPins.find((p) => canonicalPath(p.route) === key);
    return matched?.id ?? null;
  }, [hoveredUrl, publicLociPins]);

  // ── NEXT NODE — cycle the lock through the result pin set (SAME as /archive) ──
  const handleJumpNext = useCallback(() => {
    if (publicLociPins.length === 0) return;
    const curIdx = lockedEntryId
      ? publicLociPins.findIndex((p) => p.id === lockedEntryId)
      : jumpIdxRef.current - 1;
    const nextIdx = (curIdx + 1 + publicLociPins.length) % publicLociPins.length;
    jumpIdxRef.current = nextIdx;
    setLockedEntryId(publicLociPins[nextIdx].id);
  }, [publicLociPins, lockedEntryId]);

  // When the result set changes (new query), drop any stale lock so the reticle
  // does not point at a node that is no longer in the survey. queueMicrotask
  // defers the setState out of the effect body (react-hooks/set-state-in-effect —
  // same pattern as the media-query effect below + Nav.tsx).
  useEffect(() => {
    if (
      lockedEntryId &&
      !publicLociPins.some((p) => p.id === lockedEntryId)
    ) {
      queueMicrotask(() => {
        setLockedEntryId(null);
        setReadout(null);
      });
    }
  }, [publicLociPins, lockedEntryId]);

  // ── Init: detect media queries (client-only, hydration-safe) ────────────────
  useEffect(() => {
    const mqMobile = window.matchMedia("(max-width: 600px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // queueMicrotask defers the setState call out of the effect body,
    // satisfying react-hooks/set-state-in-effect (same pattern as Nav.tsx).
    queueMicrotask(() => {
      setIsMobile(mqMobile.matches);
      setReducedMotion(mqMotion.matches);
    });

    const onMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const onMotion = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mqMobile.addEventListener("change", onMobile);
    mqMotion.addEventListener("change", onMotion);
    return () => {
      mqMobile.removeEventListener("change", onMobile);
      mqMotion.removeEventListener("change", onMotion);
    };
  }, []);

  // ── Autofocus on open ────────────────────────────────────────────────────────
  useEffect(() => {
    // Small defer ensures the dialog is mounted and visible before focus
    const t = setTimeout(() => inputRef.current?.focus(), 32);
    return () => clearTimeout(t);
  }, []);

  // ── Body scroll lock while overlay is open ───────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Focus trap: Tab cycles within the dialog ─────────────────────────────────
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'input, button, a[href], [tabindex="0"]'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", handleKeyDown);
    return () => dialog.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── ESC within overlay: clear query or close ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (query) {
        e.stopPropagation();
        setQuery("");
        setSearchState({ phase: "idle", items: [] });
        setKeyboardIndex(-1);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [query, onClose]);

  // ── ↑↓ navigation in results ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const count = searchState.items.length;
      if (count === 0) return;
      e.preventDefault();
      setKeyboardIndex((prev) => {
        if (e.key === "ArrowDown") return Math.min(prev + 1, count - 1);
        return Math.max(prev - 1, 0);
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchState.items.length]);

  // ── ↵ opens the keyboard-selected result ────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (keyboardIndex < 0) return;
      const item = searchState.items[keyboardIndex];
      // canonicalPath strips the raw .html suffix so ↵ navigates to the clean
      // route (parity with the ResultCard anchor href), not the 404 raw URL.
      if (item) window.location.href = canonicalPath(item.url);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardIndex, searchState.items]);

  // ── Scroll keyboard-selected result into view ────────────────────────────────
  useEffect(() => {
    if (keyboardIndex < 0) return;
    const list = resultsListRef.current;
    if (!list) return;
    const row = list.children[keyboardIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [keyboardIndex]);

  // ── pagefind search ──────────────────────────────────────────────────────────
  const runSearch = useCallback(
    async (q: string, kind: KindFilter, sort: SortDir) => {
      if (!q.trim()) {
        setSearchState({ phase: "idle", items: [] });
        setKeyboardIndex(-1);
        return;
      }

      setSearchState((prev) => ({ ...prev, phase: "loading" }));

      try {
        // Lazy-load pagefind from the built index
        if (!pagefindRef.current) {
          // Dynamic import from the built public path.
          // Pagefind is only available after `npm run build` — during dev
          // this will fail (caught below → phase:failure shows the fallback link).
          // webpackIgnore stops bundler from trying to bundle this path.
          // The string-template indirection avoids TypeScript static resolution
          // of the non-existent module path at compile time.
          const pfPath = `/pagefind/pagefind.js`;
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore — runtime-only module, not resolvable at compile time
          pagefindRef.current = await import(/* webpackIgnore: true */ pfPath).catch(
            () => null
          );
        }

        if (!pagefindRef.current) {
          setSearchState({ phase: "failure", items: [] });
          return;
        }

        const pf = pagefindRef.current;

        // Build filters object for pagefind.
        // PHOTO filter must include "photo-roll" (roll index pages) as well as
        // "photo" (individual frames) — pagefind v1 supports array OR within a
        // filter key. Without photo-roll, roll index pages are dropped by the
        // server-side filter even though they display as PHOTO in results.
        const filters: Record<string, string | string[]> = {};
        if (kind !== "ALL") {
          if (kind === "PHOTO") {
            filters.kind = ["photo", "photo-roll"];
          } else {
            filters.kind = kind.toLowerCase();
          }
        }

        // Sort: TIME only. "NEWEST" = descending isoDate; "OLDEST" = ascending.
        // pagefind sort API: { sort: { field: "asc" | "desc" } }
        const sortParam =
          sort === "NEWEST"
            ? { isoDate: "desc" }
            : { isoDate: "asc" };

        const searchResult = await pf.search(q, {
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          sort: sortParam,
        });

        if (!searchResult || !searchResult.results) {
          setSearchState({ phase: "empty", items: [] });
          return;
        }

        // Resolve all result data
        const resolved: PagefindResult[] = await Promise.all(
          searchResult.results.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (r: any) => r.data() as Promise<PagefindResult>
          )
        );

        if (resolved.length === 0) {
          setSearchState({ phase: "empty", items: [] });
        } else {
          setSearchState({ phase: "results", items: resolved });
        }
        setKeyboardIndex(-1);
      } catch {
        setSearchState({ phase: "failure", items: [] });
      }
    },
    []
  );

  // ── Debounced search trigger ─────────────────────────────────────────────────
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      runSearch(query, kindFilter, sortDir);
    }, 120);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, kindFilter, sortDir, runSearch]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const items = searchState.items;

  const resultCountLabel = useMemo(() => {
    if (searchState.phase === "results")
      return `${items.length} result${items.length !== 1 ? "s" : ""} surveyed`;
    return "";
  }, [searchState.phase, items.length]);

  // ── Motion-aware transition ───────────────────────────────────────────────────
  const overlayTransition = reducedMotion ? "none" : "opacity 200ms ease-out";

  // ── Overlay dimension vars ───────────────────────────────────────────────────
  // Set via inline styles; media breakpoints handled via responsive grid
  const overlayStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        background: "var(--paper-base)",
      }
    : {
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      };

  const KIND_FILTERS: KindFilter[] = ["ALL", "ARTICLE", "PHOTO", "FICTION"];

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 8999,
          background: `rgb(var(--ink-rgb) / 0.15)`,
          transition: overlayTransition,
        }}
      />

      {/* Dialog wrapper */}
      <div style={overlayStyle}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="TRIANGULATE · survey the archive"
          className="paper-canvas"
          style={
            isMobile
              ? {
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                  height: "100%",
                  background: "var(--paper-base)",
                  overflowY: "auto",
                  pointerEvents: "auto",
                }
              : {
                  width: "min(940px, calc(100vw - 48px))",
                  height: "min(80vh, 760px)",
                  background: "var(--paper-base)",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  pointerEvents: "auto",
                  overflow: "hidden",
                }
          }
        >
          {/* ── Overlay header ─────────────────────────────────────────── */}
          {/* S5 safe-area: paddingTop absorbs Dynamic Island / notch on iPhone. */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "max(12px, env(safe-area-inset-top)) 16px 12px",
              borderBottom: "1px dashed var(--ink-dashed)",
              background: "var(--paper-warm)",
              position: "relative",
              flexShrink: 0,
            }}
          >
            {/* TL micro corner bracket (atom corner-reticle, micro variant) */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: "6px",
                left: "6px",
                width: "8px",
                height: "8px",
                borderTop: "1px solid var(--accent-orange)",
                borderLeft: "1px solid var(--accent-orange)",
                pointerEvents: "none",
              }}
            />

            {/* Title: TRIANGULATE */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "var(--ink-primary)",
                paddingLeft: "18px",
              }}
            >
              TRIANGULATE
            </span>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search overlay"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "8px 12px",
                minWidth: "44px",
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ESC · CLOSE ✕
            </button>
          </header>

          {/* ── q.bar ──────────────────────────────────────────────────── */}
          <div
            style={{
              padding: "12px 16px 0",
              flexShrink: 0,
            }}
          >
            <div style={{ position: "relative" }}>
              {/* Prefix glyph ⌕ */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: "var(--ink-soft)",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                ⌕
              </span>
              <input
                ref={inputRef}
                id={`${uid}-qbar`}
                type="search"
                role="combobox"
                aria-expanded={searchState.phase === "results"}
                aria-controls={`${uid}-results`}
                aria-label="search the archive"
                placeholder="survey the archive..."
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 32px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  letterSpacing: "0.05em",
                  color: "var(--ink-primary)",
                  background: "var(--paper-warm)",
                  border: "1px dashed var(--ink-dashed)",
                  borderRadius: 0,
                  outline: "none",
                  boxSizing: "border-box",
                  transition: reducedMotion ? "none" : "border-color 120ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border =
                    "1px solid var(--ink-primary)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border =
                    "1px dashed var(--ink-dashed)";
                }}
              />
            </div>
          </div>

          {/* ── Filter chip rows ───────────────────────────────────────── */}
          <div
            style={{
              padding: "10px 16px 0",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              flexShrink: 0,
            }}
          >
            {/* Row 1: kind radio group */}
            <div
              role="radiogroup"
              aria-label="filter by kind"
              style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
            >
              {KIND_FILTERS.map((k) => (
                <KindChip
                  key={k}
                  label={k}
                  active={kindFilter === k}
                  onClick={() => {
                    setKindFilter(k);
                    setKeyboardIndex(-1);
                  }}
                  reducedMotion={reducedMotion}
                />
              ))}
            </div>

            {/* Row 2: sort toggle (right-aligned, no facet popovers in v1) */}
            <div
              role="group"
              aria-label="sort"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "6px",
              }}
            >
              <SortToggle
                dir={sortDir}
                onToggle={() => {
                  setSortDir((d) => (d === "NEWEST" ? "OLDEST" : "NEWEST"));
                  setKeyboardIndex(-1);
                }}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>

          {/* ── NETRA ambient narration (empty-query state) ─────────────── */}
          {searchState.phase === "idle" && (
            <div
              aria-live="polite"
              role="status"
              style={{
                padding: "12px 16px 0",
                flexShrink: 0,
              }}
            >
              <aside
                className="atlas-netra-voice"
                style={{ marginLeft: 0 }}
              >
                <span className="voice-tag">NETRA ▸</span>
                <span className="voice-body">
                  survey the archive · landing state · newest first · the archive is open
                </span>
              </aside>
            </div>
          )}

          {/* ── Live result count announcement ──────────────────────────── */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{
              position: "absolute",
              left: "-9999px",
              width: "1px",
              height: "1px",
              overflow: "hidden",
            }}
          >
            {resultCountLabel}
          </div>

          {/* ── Main body: results + globe ──────────────────────────────── */}
          <div
            style={
              isMobile
                ? {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    padding: "12px 0 0",
                  }
                : {
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: "1fr 380px",
                    gap: "24px",
                    minHeight: 0,
                    padding: "12px 0 0",
                  }
            }
          >
            {/* ── Results column ───────────────────────────────────────── */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {/* Section label */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "7px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--ink-soft)",
                  padding: "0 16px 6px",
                  borderBottom: "1px dashed var(--ink-dashed)",
                  flexShrink: 0,
                }}
              >
                ─ SURVEY ─────────────────────────────────────────
              </div>

              {/* Results list */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {searchState.phase === "loading" && (
                  <div
                    style={{
                      padding: "16px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.3em",
                      color: "var(--ink-faint)",
                      textTransform: "uppercase",
                    }}
                    aria-live="polite"
                  >
                    {"// surveying..."}
                  </div>
                )}

                {searchState.phase === "empty" && (
                  <div
                    style={{
                      padding: "16px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.3em",
                      color: "var(--ink-faint)",
                      textTransform: "uppercase",
                    }}
                    aria-live="polite"
                  >
                    {`// nothing surveyed · no match for "${query}"`}
                  </div>
                )}

                {searchState.phase === "failure" && (
                  <div
                    style={{
                      padding: "16px",
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.3em",
                      color: "var(--ink-faint)",
                      textTransform: "uppercase",
                    }}
                    aria-live="polite"
                  >
                    {"// triangulation offline ·"}{" "}
                    <a
                      href="#chapter-index"
                      onClick={onClose}
                      style={{ color: "var(--ink-primary)" }}
                    >
                      ↓ entries list
                    </a>
                  </div>
                )}

                {searchState.phase === "results" && (
                  <ol
                    ref={resultsListRef}
                    id={`${uid}-results`}
                    role="listbox"
                    aria-label="search results"
                    style={{ listStyle: "none", margin: 0, padding: 0 }}
                  >
                    {items.map((item, idx) => (
                      <ResultCard
                        key={item.url}
                        item={item}
                        isKeySelected={keyboardIndex === idx}
                        isGlobeActive={
                          hoveredUrl != null &&
                          canonicalPath(hoveredUrl) === canonicalPath(item.url)
                        }
                        isMobile={isMobile}
                        query={query}
                        onHover={setHoveredUrl}
                        reducedMotion={reducedMotion}
                      />
                    ))}
                  </ol>
                )}
              </div>

              {/* Keyboard hint footer */}
              <div
                aria-hidden
                style={{
                  padding: "8px 16px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "8px",
                  letterSpacing: "0.22em",
                  color: "var(--ink-faint)",
                  borderTop: "1px dashed var(--ink-dashed)",
                  flexShrink: 0,
                  textTransform: "uppercase",
                }}
              >
                ↑↓ navigate · ↵ open · ⇥ chips · ESC close
              </div>
            </div>

            {/* ── Globe (coordinates) column ──────────────────────────── */}
            {!isMobile && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  position: "sticky",
                  top: 0,
                  alignSelf: "start",
                  padding: "0 16px 16px 0",
                }}
              >
                {/* Section label */}
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "7px",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    width: "100%",
                    paddingBottom: "6px",
                    borderBottom: "1px dashed var(--ink-dashed)",
                    marginBottom: "8px",
                  }}
                >
                  ─ COORDINATES ─────────────────────────────────
                </div>

                {/*
                 * Mini-globe atom — the SAME refined instrument /archive uses,
                 * wired the SAME way (the consistency port · Peat 2026-06-04).
                 * size={348}: Triangulate overlay variant per §5.5.
                 * publicLociPins: all coord-bearing results in the current set.
                 * matchedPins: activePins (all in overlay; no extra filter layer).
                 * hoveredEntryId: derived from hoveredUrl via pin.route match (§5.8).
                 * onPinHover: sets hoveredUrl via pin.route → drives isGlobeActive
                 *   on the matching ResultCard, completing bidirectional sync.
                 * onReadout / lockedEntryId / onLockChange: identical wiring to
                 *   ArchiveClient — the globe broadcasts the RETICLE/DRIFT/BEARING/
                 *   STRATUM readout + click-lock, rendered by <ArchiveGlobeReadout>.
                 * onPinClick: navigates to the entry route and closes the overlay.
                 * onGlobeClick: clears the lock only (anti-bounce); stays open.
                 */}
                <ArchiveMiniGlobe
                  size={348}
                  pins={publicLociPins}
                  activePins={matchedPins}
                  hoveredEntryId={hoveredEntryId}
                  onPinHover={(entryId) => {
                    // Reverse-lookup: entryId → route → hoveredUrl so ResultCard
                    // isGlobeActive highlights the matching row.
                    if (entryId === null) {
                      setHoveredUrl(null);
                      return;
                    }
                    const pin = publicLociPins.find((p) => p.id === entryId);
                    if (pin) setHoveredUrl(pin.route);
                  }}
                  onPinClick={(pin) => {
                    onClose();
                    router.push(pin.route);
                  }}
                  onGlobeClick={() => {
                    // ANTI-BOUNCE: a bare-surface click clears the in-globe lock
                    // (free exploration) and leaves the overlay open. Clone WL L1007.
                    setLockedEntryId(null);
                  }}
                  onReadout={setReadout}
                  lockedEntryId={lockedEntryId}
                  onLockChange={setLockedEntryId}
                />

                {/* RETICLE / DRIFT A / BEARING / STRATUM / COORD / α readout —
                    the SAME shared panel /archive renders under its globe. */}
                <ArchiveGlobeReadout
                  readout={readout}
                  hasPins={publicLociPins.length > 0}
                  onJumpNext={handleJumpNext}
                />
              </div>
            )}

            {/* Globe below results on mobile — same atom, 300px max-width */}
            {isMobile && items.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "16px",
                  gap: "8px",
                }}
              >
                {/* size={300}: mobile uses archive right-rail variant (smaller
                    canvas). SAME wiring as desktop / /archive — refined instrument
                    + shared readout panel. */}
                <ArchiveMiniGlobe
                  size={300}
                  pins={publicLociPins}
                  activePins={matchedPins}
                  hoveredEntryId={hoveredEntryId}
                  onPinHover={(entryId) => {
                    if (entryId === null) { setHoveredUrl(null); return; }
                    const pin = publicLociPins.find((p) => p.id === entryId);
                    if (pin) setHoveredUrl(pin.route);
                  }}
                  onPinClick={(pin) => { onClose(); router.push(pin.route); }}
                  onGlobeClick={() => {
                    // ANTI-BOUNCE: bare-surface click clears the lock only.
                    setLockedEntryId(null);
                  }}
                  onReadout={setReadout}
                  lockedEntryId={lockedEntryId}
                  onLockChange={setLockedEntryId}
                />
                <ArchiveGlobeReadout
                  readout={readout}
                  hasPins={publicLociPins.length > 0}
                  onJumpNext={handleJumpNext}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TriangulateSearchOverlay — portal wrapper that mounts into document.body
// ─────────────────────────────────────────────────────────────────────────────

interface TriangulateSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Full privacy-gated pin set (same source as /archive). Threaded to the globe. */
  allPins?: MiniGlobePin[];
}

export function TriangulateSearchOverlay({
  isOpen,
  onClose,
  allPins = [],
}: TriangulateSearchOverlayProps) {
  const [mounted, setMounted] = useState(false);

  // Mount guard — createPortal requires document to exist (client-only).
  // queueMicrotask defers setState out of the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <TriangulateSearch onClose={onClose} allPins={allPins} />,
    document.body
  );
}
