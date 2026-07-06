"use client";

import { useEffect, useState } from "react";

/**
 * BangkokClock — client leaf inside LedgerTopBar.
 *
 * Modelled after components/Nav.tsx's clock, but fixes the bug that clock
 * has: Nav shows the VISITOR's local time mislabeled "UTC+7". A recruiter
 * opening this page from anywhere in the world should see the observer's
 * actual local time in Bangkok, so this formats with an explicit IANA
 * zone instead of trusting the visitor's `Date` offset.
 *
 * Hydration-safe per Sirius's quality bar: no `Date.now()` during the
 * initial render. SSR and the first client paint both show "--:--";
 * the real time is read only after mount, then refreshed on an interval.
 */
const FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function BangkokClock() {
  const [time, setTime] = useState<string>("--:--");

  useEffect(() => {
    const update = () => setTime(FORMATTER.format(new Date()));
    update();
    const id = setInterval(update, 20_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span data-wl-clock suppressHydrationWarning>
      UTC+7 {"//"} {time}
    </span>
  );
}
