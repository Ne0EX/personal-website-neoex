interface CornerMarksProps {
  /**
   * Overrides the atom's default `inset: 16px`. The résumé ledger reuses
   * this atom at two tighter insets (flush on the colophon box border,
   * 7px inside the α work card) — ported as inline style since the design
   * bundle itself expresses these as one-off inline overrides, not new
   * atom variants (see docs/design + Worldline Résumé - NETRA Survey.dc.html).
   */
  inset?: number | string;
}

export function CornerMarks({ inset }: CornerMarksProps = {}) {
  return (
    <div
      className="corner-marks"
      style={inset !== undefined ? { inset } : undefined}
      aria-hidden
    />
  );
}
