import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Special_Elite } from "next/font/google";
import "./globals.css";

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
  // Lets URL-based metadata fields below this segment (canonical, openGraph.url,
  // og:image, …) — see app/page.tsx and app/atlas/page.tsx — use relative paths
  // or the bare production domain instead of each repeating an absolute URL.
  // resume.neoex.dev is `/`'s own domain now (S5 root swap); `/atlas` and every
  // other route are served from the same deployment.
  metadataBase: new URL("https://resume.neoex.dev"),
  title: "Worldline · ∇ Neospirit",
  description:
    "An archive of unfinished thought, kept openly. A digital garden — fragments, drafts, and half-formed theories on coffee, code, narrative, and the architecture of taste.",
};

/**
 * `viewportFit: "cover"` lets the résumé ledger's NETRA bay (S6+) sit flush
 * against the bottom of notched/home-indicator iOS viewports and pad itself
 * correctly with `env(safe-area-inset-bottom)` (already consumed by
 * components/netra/netra-bay.css's `[data-bay-row]`) instead of leaving a
 * blank strip under the console. Site-wide in the root layout — harmless on
 * routes that don't read the safe-area env vars.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jetbrains.variable} ${elite.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
