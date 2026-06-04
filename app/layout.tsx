import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Special_Elite } from "next/font/google";
import "./globals.css";
import { TriangulateSearchPortal } from "@/components/TriangulateSearchPortal";
import { getArchiveEntries, getMiniGlobePins } from "@/lib/content";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const elite = Special_Elite({
  variable: "--font-elite",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Worldline · ∇ Neospirit",
  description:
    "An archive of unfinished thought, kept openly. A digital garden — fragments, drafts, and half-formed theories on coffee, code, narrative, and the architecture of taste.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Full privacy-gated pin set — the SAME source /archive uses
  // (getMiniGlobePins over the full corpus). Passed to the overlay so its globe
  // can plot the SAME loci /archive plots, intersected by the pagefind result
  // URLs. Computed here (server) since the overlay is a global client mount with
  // no corpus of its own. RootLayout is statically rendered (no request-time
  // API read), so this stays in the static graph.
  const allEntries = await getArchiveEntries();
  const allPins = getMiniGlobePins(allEntries);

  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jetbrains.variable} ${elite.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/*
         * Triangulate Search OVERLAY — root-level mount (Peat 2026-06-04).
         * Hosts the global '/' hotkey listener + the 'triangulate:open' event
         * listener, so the SEARCH surface opens OVER any page (home, articles,
         * /archive) without navigating. The overlay shares the SAME refined globe
         * instrument as /archive (ArchiveMiniGlobe + ArchiveGlobeReadout) AND the
         * SAME pin data (allPins), so the two globes can never drift.
         */}
        <TriangulateSearchPortal allPins={allPins} />
      </body>
    </html>
  );
}
