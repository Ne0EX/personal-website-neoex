"use client";

/**
 * AttractorFilterShell.tsx
 * ─────────────────────────
 * Thin client shell that lifts the `activeAttractor` state shared by
 * AttractorFields (§02 pill strip) and ChapterIndex (§01 entry list).
 *
 * WHY a shell rather than context: both consumers are direct children here
 * and there is only one selection cursor; prop-drilling one level is simpler
 * and avoids an additional provider boundary.
 *
 * Normalization contract:
 *   normalize(s) → lowercase, strip non-alphanumeric chars.
 *   "ai · ml"  → "aiml"
 *   "coffee"   → "coffee"
 *   "meta"     → "meta"
 * An entry matches pill P when any of entry.tags (normalized) === normalize(P).
 * "all" is the reset sentinel — never normalized against tags.
 *
 * DivergenceMeter: lives in app/page.tsx (server component) — this shell
 * does NOT wrap or touch it, preserving the contract that it never recomputes
 * on filter state changes.
 *
 * Owner: Sirius (α-SUR-01) · attractor-filter slice
 */

import { useState, useMemo } from "react";
import { ATTRACTOR_FIELDS, RECENT_ENTRIES, type Entry } from "@/lib/entries";
import { AttractorFields } from "@/components/AttractorFields";
import { ChapterIndex } from "@/components/ChapterIndex";

/** Normalize a tag/pill string for fuzzy matching. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Compute how many RECENT_ENTRIES match each ATTRACTOR_FIELDS pill.
 * "all" is always the full count.
 */
function buildMemberCounts(entries: Entry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pill of ATTRACTOR_FIELDS) {
    if (pill === "all") {
      counts[pill] = entries.length;
      continue;
    }
    const normPill = normalize(pill);
    counts[pill] = entries.filter((e) =>
      e.tags.some((t) => normalize(t) === normPill)
    ).length;
  }
  return counts;
}

export function AttractorFilterShell() {
  const [activeAttractor, setActiveAttractor] = useState<string>("all");

  // memberCounts never changes across the page lifetime (entries are static
  // build-time data) — compute once.
  const memberCounts = useMemo(() => buildMemberCounts(RECENT_ENTRIES), []);

  // Filter entries. "all" (or any pill with count 0 somehow becoming active)
  // returns the full list. useMemo because RECENT_ENTRIES is static.
  const filteredEntries = useMemo(() => {
    if (activeAttractor === "all") return RECENT_ENTRIES;
    const normPill = normalize(activeAttractor);
    return RECENT_ENTRIES.filter((e) =>
      e.tags.some((t) => normalize(t) === normPill)
    );
  }, [activeAttractor]);

  function handleSelect(tag: string) {
    // Clicking the active pill again resets to "all" (clear behavior).
    setActiveAttractor((prev) => (prev === tag ? "all" : tag));
  }

  return (
    <>
      {/* §01 — filtered by activeAttractor */}
      <ChapterIndex entries={filteredEntries} activeAttractor={activeAttractor} />

      {/* §02 — pill strip; drives filter */}
      <AttractorFields
        activeAttractor={activeAttractor}
        onSelect={handleSelect}
        memberCounts={memberCounts}
      />
    </>
  );
}
