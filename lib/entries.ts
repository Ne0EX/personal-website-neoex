export type EntryStatus = "seed" | "ongoing" | "refined" | "settled";

export type Entry = {
  fileNum: string;       // zero-padded "003"
  title: string;
  date: string;          // yyyy.mm.dd display string
  domain: string;        // human label — used in callout
  tags: string[];
  status: EntryStatus;
  readingTime: number;   // minutes
  /**
   * Longitude in degrees [-180, 180]. Kept for legacy compatibility but the
   * ATLAS scene places nodes by `coords.lat`/`coords.lon` (real geography).
   */
  lon: number;
  /** Real-world coordinate where this entry is anchored on the globe. */
  coords: { lat: number; lon: number; place: string };
  /** One-paragraph excerpt shown in the side panel when an entry is selected. */
  summary: string;
};

/**
 * Non-entry archive nodes — observation points marked on the globe but not
 * clickable as articles. α is the observer's locus; 012 and 047 are
 * historical reference points (active branch / meta vantage).
 */
export type ArchiveNode = {
  label: string;
  primary?: boolean;
  coords: { lat: number; lon: number; place: string };
  why: string;
};

export const OBSERVER_NODES: ArchiveNode[] = [
  {
    label: "α",
    primary: true,
    coords: { lat: 13.7563, lon: 100.5018, place: "Bangkok · TH" },
    why: "observer's locus",
  },
  {
    label: "012",
    coords: { lat: 35.6762, lon: 139.6503, place: "Tokyo · JP" },
    why: "narrative · active branch",
  },
  {
    label: "047",
    coords: { lat: -48.8767, lon: -123.3933, place: "Point Nemo · PAC" },
    why: "meta vantage · most remote",
  },
];

/**
 * Attractor-field geometry.
 *
 * The globe is a polar map of the worldline viewed from above. The center is
 * the attractor (the present moment, the pull of unwritten thought). Entries
 * orbit at radii determined by lifecycle stage, and at angles determined by
 * thematic domain.
 *
 *   STAGE_RADIUS — distance from the attractor center.
 *     seed     : closest to the pull, raw
 *     ongoing  : being shaped
 *     refined  : near final form
 *     settled  : outermost, anchored
 *
 *   DOMAIN_ANGLE — angular position around the attractor (degrees, 0° = top, clockwise).
 *     identity   : 0°   (12 o'clock)
 *     reflection : 90°  (3 o'clock)
 *     method     : 180° (6 o'clock)
 *     meta       : 270° (9 o'clock)
 */
export const STAGE_RADIUS: Record<EntryStatus, number> = {
  seed:    38,
  ongoing: 68,
  refined: 98,
  settled: 128,
};

export const DOMAIN_ANGLE: Record<string, number> = {
  identity:   0,
  reflection: 90,
  method:     180,
  meta:       270,
};

export const STAGE_ORDER: EntryStatus[] = ["seed", "ongoing", "refined", "settled"];

export const DOMAIN_ORDER: { key: string; label: string; angle: number }[] = [
  { key: "identity",   label: "IDENTITY",   angle:   0 },
  { key: "reflection", label: "REFLECTION", angle:  90 },
  { key: "method",     label: "METHOD",     angle: 180 },
  { key: "meta",       label: "META",       angle: 270 },
];

/** Attractor-field tag pills for the §02 browse strip. */
export const ATTRACTOR_FIELDS: string[] = [
  "all",
  "coffee",
  "ai · ml",
  "narrative",
  "cubic copper",
  "harness eng.",
  "fragrance",
  "film · letterboxd",
  "trading",
  "japan / 日本",
  "meta",
];

export const RECENT_ENTRIES: Entry[] = [
  {
    fileNum: "003",
    title: "on the architecture of taste",
    date: "2026.05.07",
    domain: "identity",
    tags: ["essay", "identity"],
    status: "ongoing",
    readingTime: 8,
    lon: -55,
    coords: { lat: 35.0116, lon: 135.7681, place: "Kyoto · JP" },
    summary:
      "Taste isn't preference; it's a load-bearing structure. A quiet record of what you choose to keep, what you let go, and the residue that becomes you. Working notes on building taste as architecture, not decoration.",
  },
  {
    fileNum: "002",
    title: "why I paused the startup",
    date: "2026.05.02",
    domain: "reflection",
    tags: ["reflection", "stride"],
    status: "settled",
    readingTime: 12,
    lon: 35,
    coords: { lat: 18.7883, lon: 98.9853, place: "Chiang Mai · TH" },
    summary:
      "Stride wasn't failing — but it was demanding the wrong shape of me. The decision to pause, the cost of stopping while still in motion, and what the ground looked like once I got off the treadmill.",
  },
  {
    fileNum: "001",
    title: "the four pours adaptation",
    date: "2026.04.28",
    domain: "method",
    tags: ["method", "coffee"],
    status: "refined",
    readingTime: 15,
    lon: -25,
    coords: { lat: 6.16, lon: 38.2058, place: "Yirgacheffe · ET" },
    summary:
      "A four-pour V60 method tuned for the specific extraction curve I want: clarity in the front half, weight in the back. Recipe, ratios, agitation notes, and the small bug that took six weeks to find.",
  },
  {
    fileNum: "000",
    title: "notes from a paused engineer",
    date: "2026.04.20",
    domain: "meta",
    tags: ["genesis", "meta"],
    status: "seed",
    readingTime: 5,
    lon: 75,
    coords: { lat: 37.7749, lon: -122.4194, place: "San Francisco · US" },
    summary:
      "Genesis fragment. Why a digital garden and not a blog. What I'm trying to keep openly, what stays in the drawer, and the rule I'm using to decide which is which.",
  },
];
