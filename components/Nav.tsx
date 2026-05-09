"use client";

import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "INDEX",     href: "#hero",      active: true  },
  { label: "TRACES",    href: "#index",     active: false },
  { label: "ARCHIVE",   href: "#attractor", active: false },
  { label: "TRANSMIT",  href: "#transmit",  active: false },
];

function fmtTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function Nav() {
  const [time, setTime] = useState<string>("--:--");

  useEffect(() => {
    const update = () => setTime(fmtTime(new Date()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="nav-shell relative z-[3] section-rule">
      <div className="nav-id t-meta">
        <div>
          <span className="t-meta-accent">∇ NEOSPIRIT {"//"} WORLDLINE 1.130426</span>
        </div>
        <div className="mt-1.5 text-[var(--ink-soft)]">
          EST. 2026 — BANGKOK / THAILAND
        </div>
      </div>

      <nav className="nav-links t-meta">
        {NAV_ITEMS.map(({ label, href, active }) => (
          <a
            key={label}
            href={href}
            className={
              active
                ? "text-[var(--accent-orange)]"
                : "text-[var(--ink-primary)] hover:text-[var(--accent-orange)] transition-colors"
            }
          >
            ◇ {label}
          </a>
        ))}
      </nav>

      <div className="nav-clock t-meta">
        <div>SYS {"//"} CALIBRATED</div>
        <div suppressHydrationWarning>UTC+7 {"//"} {time}</div>
      </div>
    </div>
  );
}
