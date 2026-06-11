// ── Views: Overview / Pipeline / TASK detail / Agents ─────────────────────
// Adapted from the prototype to render real collector data from dashboard.json.
// Where a field is null/missing, renders "insufficient data" rather than
// fabricating numbers. summarizeTickets() is used unchanged from factory-data.js.
const FV = window.Factory;

// ── Period label helpers (real periods only have {key,count}) ─────────────
const MONTH_LABELS = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };
function enrichMonths(months) {
  return (months || []).map(m => {
    const [y, mo] = m.key.split('-');
    return {
      ...m,
      y: parseInt(y, 10),
      m: parseInt(mo, 10) - 1, // 0-indexed like Date.getMonth()
      label: m.label || (MONTH_LABELS[mo] + ' ' + y),
    };
  });
}
function enrichQuarters(quarters) {
  // Q2 2026 → months [3,4,5]; Q1 → [0,1,2]
  return (quarters || []).map(q => {
    const [y, qStr] = q.key.split('-');
    const qNum = parseInt((qStr || 'Q1').replace('Q', ''), 10);
    const months = [0, 1, 2].map(i => (qNum - 1) * 3 + i);
    return {
      ...q,
      y: parseInt(y, 10),
      label: q.label || (qStr + ' ' + y),
      months,
    };
  });
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────
function OverviewView({ data, unit, openTask }) {
  const { totals, byModel, byDomain, byRole, days, features } = data;
  const v = data.validation;

  // byModel may include ids not in FV.MODELS (defensive)
  const modelRows = Object.entries(byModel)
    .filter(([id]) => FV.MODELS[id])
    .map(([id, m]) => ({
      label: FV.MODELS[id].label,
      value: unit === 'cost' ? (m.cost || 0) : (m.tokens || 0),
      color: FV.MODELS[id].color,
    })).sort((a, b) => b.value - a.value);

  const domainRows = FV.DOMAINS.map(d => ({
    label: d.label,
    value: unit === 'cost'
      ? (byDomain[d.id] ? (byDomain[d.id].cost || 0) : 0)
      : (byDomain[d.id] ? (byDomain[d.id].tokens || 0) : 0),
    color: d.color,
  }));

  // Top TASKs by cost (only those with a known cost)
  const topFeatures = [...features]
    .filter(f => f.cost != null)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  // Validation fields — all may be null in real data
  const autonomyRate = v.autonomyRate != null ? v.autonomyRate : null;
  const mitigatedCost = v.mitigatedCost != null ? v.mitigatedCost : null;
  const caughtIssues = v.caughtIssues != null ? v.caughtIssues : null;
  const humanHours = v.humanHours != null ? v.humanHours : null;
  const humanGates = v.human != null ? v.human : null;
  const reasoningTokens = totals.reasoningTokens != null ? totals.reasoningTokens : null;

  return (
    <div className="view">
      <div className="stat-grid">
        <StatCard label="Spend · all time" value={FV.fmtCost(totals.cost || 0)} sub={FV.fmtTokens(totals.tokens || 0) + ' tokens'} accent="var(--accent)" />
        <StatCard label="Agent runs" value={(totals.calls || 0).toLocaleString()} sub={(totals.running || 0) + ' running now'} />
        <StatCard label="TASKs in flight" value={totals.inFlight || 0} sub={(totals.shipped || 0) + ' shipped'} />
        <StatCard label="Cost / TASK" value={
          (totals.shipped || totals.inFlight)
            ? FV.fmtCost((totals.cost || 0) / Math.max(1, (totals.shipped || 0) + (totals.inFlight || 0)))
            : '—'
        } sub="blended average" />
      </div>
      <div className="stat-grid hitl-grid">
        <StatCard label="Factory autonomy"
          value={autonomyRate != null ? Math.round(autonomyRate * 100) + '%' : 'insufficient data'}
          sub="gates cleared without a human"
          accent="#7fae6a" />
        <StatCard label="Impact mitigated"
          value={mitigatedCost != null ? FV.fmtCost(mitigatedCost) : 'insufficient data'}
          sub={caughtIssues != null ? caughtIssues + ' issues caught at the gate' : 'gate issue data not available'}
          accent="#c9a857" />
        <StatCard label="Human review"
          value={humanHours != null ? humanHours.toFixed(1) + 'h' : 'insufficient data'}
          sub={humanGates != null ? humanGates + ' escalated gates' : ''} />
        <StatCard label="Reasoning tokens"
          value={reasoningTokens != null && reasoningTokens > 0 ? FV.fmtTokens(reasoningTokens) : 'insufficient data'}
          sub={reasoningTokens != null && (totals.tokens || 0) > 0
            ? Math.round((reasoningTokens / totals.tokens) * 100) + '% spent thinking'
            : 'not recorded in this build'} />
      </div>

      <div className="panel-row">
        <div className="panel grow-2">
          <div className="panel-head">
            <h3>Daily burn by model</h3>
            <div className="legend">
              {Object.entries(FV.MODELS).map(([id, m]) => (
                <span key={id} className="legend-item"><i style={{ background: m.color }}></i>{m.label}</span>
              ))}
            </div>
          </div>
          {(days && days.length > 0) ? <DailyBars days={days} height={150} /> : <div className="tree-queued-note">No daily data available.</div>}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>{unit === 'cost' ? 'Cost' : 'Tokens'} by model</h3></div>
          {modelRows.length ? <BreakdownBars rows={modelRows} unit={unit} /> : <div className="tree-queued-note">No model data.</div>}
          <div className="panel-head" style={{ marginTop: 18 }}><h3>{unit === 'cost' ? 'Cost' : 'Tokens'} by agent territory</h3></div>
          {domainRows.some(r => r.value > 0) ? <BreakdownBars rows={domainRows} unit={unit} /> : <div className="tree-queued-note">No territory data.</div>}
        </div>
      </div>

      {topFeatures.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h3>Most expensive TASKs</h3><span className="panel-hint">click to inspect</span></div>
          <table className="data-table">
            <thead><tr><th>TASK</th><th>Priority</th><th>Territories</th><th>Runs</th><th>Tokens</th><th>Cost</th></tr></thead>
            <tbody>
              {topFeatures.map(f => (
                <tr key={f.id} onClick={() => openTask(f.id)}>
                  <td><span className="feat-key">{f.key}</span> {f.title}</td>
                  <td><PriorityTag p={f.priority} /></td>
                  <td><DomainStepper feature={f} /></td>
                  <td className="num">{f.runs != null ? f.runs : '—'}</td>
                  <td className="num">{f.tokens != null ? FV.fmtTokens(f.tokens) : '—'}</td>
                  <td className="num cost-cell">{f.cost != null ? FV.fmtCost(f.cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {topFeatures.length === 0 && (
        <div className="panel">
          <div className="panel-head"><h3>Most expensive TASKs</h3></div>
          <div className="tree-queued-note">Cost data not available for current TASKs (backfill-low fidelity).</div>
        </div>
      )}
    </div>
  );
}

// ── PIPELINE ──────────────────────────────────────────────────────────────
function PipelineView({ data, openTask }) {
  // Real data: features have reach=null and domains=string[].
  // We bucket by status instead of by reach index.
  const inFlight = data.features.filter(f => f.status === 'in-flight');
  const shipped = data.features.filter(f => f.status === 'shipped');

  // Group in-flight features by their last recorded domain territory, or "product" if none
  const DOMAIN_ORDER = FV.DOMAINS.map(d => d.id); // product, design, engineering, qa, deploy
  function lastDomain(feature) {
    const domains = feature.domains || [];
    if (!domains.length) return 'product';
    // domains is either string[] (real) or object[] (mock)
    const ids = domains.map(d => typeof d === 'string' ? d : d.id);
    // Return the last domain id found in DOMAIN_ORDER
    for (let i = DOMAIN_ORDER.length - 1; i >= 0; i--) {
      if (ids.includes(DOMAIN_ORDER[i])) return DOMAIN_ORDER[i];
    }
    return ids[ids.length - 1] || 'product';
  }

  // lastDomain() already returns 'product' for features with no domains,
  // so the single filter pass below places every feature in exactly one column.
  // The earlier noDomainFeatures block that appended them a second time has been removed.
  const cols = FV.DOMAINS.map(d => ({
    ...d,
    features: inFlight.filter(f => lastDomain(f) === d.id),
  }));

  return (
    <div className="view">
      <div className="board">
        {cols.map(col => (
          <div className="board-col" key={col.id} style={{ '--dom-c': col.color }}>
            <div className="board-col-head">
              <span className="board-col-name">{col.label}</span>
              <span className="board-col-count">{col.features.length}</span>
            </div>
            <div className="board-cards">
              {col.features.map(f => (
                <div className="feat-card" key={f.id} onClick={() => openTask(f.id)}>
                  <div className="feat-card-top">
                    <span className="feat-key">{f.key}</span>
                    <PriorityTag p={f.priority} />
                  </div>
                  <div className="feat-card-title">{f.title}</div>
                  <DomainStepper feature={f} />
                  <div className="feat-card-meta">
                    {f.tokens != null ? <span>{FV.fmtTokens(f.tokens)} tok</span> : null}
                    {f.cost != null ? <span>{FV.fmtCost(f.cost)}</span> : null}
                    {f.ageDays != null ? <span>{f.ageDays}d</span> : null}
                  </div>
                </div>
              ))}
              {col.features.length === 0 && <div className="board-empty">—</div>}
            </div>
          </div>
        ))}
        <div className="board-col board-col-shipped">
          <div className="board-col-head">
            <span className="board-col-name">Shipped</span>
            <span className="board-col-count">{shipped.length}</span>
          </div>
          <div className="board-cards">
            {shipped.map(f => (
              <div className="feat-card feat-card-shipped" key={f.id} onClick={() => openTask(f.id)}>
                <div className="feat-card-top">
                  <span className="feat-key">{f.key}</span>
                  <span className="ship-check">✓</span>
                </div>
                <div className="feat-card-title">{f.title}</div>
                <div className="feat-card-meta">
                  {f.tokens != null ? <span>{FV.fmtTokens(f.tokens)} tok</span> : null}
                  {f.cost != null ? <span>{FV.fmtCost(f.cost)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TASK DETAIL ──────────────────────────────────────────────────────────
function TaskDetailView({ data, featureId, back, dense }) {
  const f = data.features.find(x => x.id === featureId);
  if (!f) return <div className="view"><div className="panel">TASK not found.</div></div>;

  const autonomous = (f.gates || []).length > 0 && (f.gates || []).every(g => g.by === 'agent');

  return (
    <div className="view">
      <div className="detail-head">
        <button className="back-btn" onClick={back}>← Back</button>
        <div className="detail-title-wrap">
          <div className="detail-eyebrow">
            <span className="feat-key">{f.key}</span>
            {f.type && <span className={'ttype ttype-' + f.type.toLowerCase()}>{f.type}</span>}
            <PriorityTag p={f.priority} />
            <StatusDot status={f.status} />
            <span className="detail-status">{f.status}</span>
            <span className={'auto-badge ' + (autonomous ? 'auto-yes' : 'auto-no')}>
              {autonomous ? '◇ fully autonomous' : '◆ human in loop'}
            </span>
          </div>
          <h2 className="detail-title">{f.title}</h2>
        </div>
        <div className="detail-stats">
          <div>
            <span className="ds-val">{f.cost != null ? FV.fmtCost(f.cost) : '—'}</span>
            <span className="ds-label">cost</span>
          </div>
          <div>
            <span className="ds-val">{f.tokens != null ? FV.fmtTokens(f.tokens) : '—'}</span>
            <span className="ds-label">tokens</span>
          </div>
          {f.hoursSaved != null ? (
            <div>
              <span className="ds-val" style={{ color: '#7fae6a' }}>{f.hoursSaved}h</span>
              <span className="ds-label">saved vs {f.baselineHours}h base</span>
            </div>
          ) : (
            <div>
              <span className="ds-val" style={{ color: 'var(--faint)', fontSize: '13px' }}>insufficient data</span>
              <span className="ds-label">cycle-time savings</span>
            </div>
          )}
          <div>
            <span className="ds-val">{f.runs != null ? f.runs : '—'}</span>
            <span className="ds-label">agent runs</span>
          </div>
        </div>
      </div>
      <DomainStepper feature={f} size="lg" />
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h3>Agent spawn tree</h3>
          <span className="panel-hint">orchestrator → agent-territory runs · ⌁ = routing note</span>
        </div>
        <SpawnTree feature={f} dense={dense} />
      </div>
    </div>
  );
}

// ── AGENTS ────────────────────────────────────────────────────────────────
function AgentsView({ data, unit }) {
  const roles = Object.entries(data.byRole)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => (b.calls || 0) - (a.calls || 0));
  const maxCalls = Math.max(...roles.map(r => r.calls || 0), 1);
  return (
    <div className="view">
      <div className="agent-grid">
        {roles.map(r => {
          const dom = FV.DOMAINS.find(d => d.id === r.domain);
          const heat = (r.calls || 0) / maxCalls;
          const defModel = (FV.ROLES.find(x => x.id === r.id) || {}).model;
          return (
            <div className="agent-card" key={r.id} style={{ '--heat': heat, '--dom-c': dom ? dom.color : 'var(--accent)' }}>
              <div className="agent-card-head">
                <span className="agent-name">{r.id}</span>
                {r.running > 0 ? <span className="agent-live"><StatusDot status="running" />{r.running}</span> : null}
              </div>
              <div className="agent-domain">{dom ? dom.label : 'Factory-wide'} · {defModel && FV.MODELS[defModel] ? FV.MODELS[defModel].label : (defModel || '')}</div>
              <div className="agent-heat-track"><div className="agent-heat-fill"></div></div>
              <div className="agent-meta">
                <span><b>{r.calls || 0}</b> calls</span>
                <span><b>{r.tokens != null ? FV.fmtTokens(r.tokens) : '—'}</b> tok</span>
                <span><b>{r.cost != null ? FV.fmtCost(r.cost) : '—'}</b></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VALIDATION — retrospective, period-driven (month / quarter picker) ────
function CycleRow({ row }) {
  const max = Math.max(row.baselineMedian, row.actualMedian, 1);
  return (
    <div className="cycle-row">
      <div className="cycle-head">
        <span className="cycle-type">{row.type}</span>
        <span className="cycle-count">{row.count} TASKs</span>
        <span className="cycle-speed">{row.speedup.toFixed(1)}× faster</span>
      </div>
      <div className="cycle-bars">
        <div className="cycle-bar"><span className="cb-label">before</span><span className="cb-track"><span className="cb-fill cb-before" style={{ width: (row.baselineMedian / max * 100) + '%' }}></span></span><span className="cb-val">{row.baselineMedian}h</span></div>
        <div className="cycle-bar"><span className="cb-label">after</span><span className="cb-track"><span className="cb-fill cb-after" style={{ width: (row.actualMedian / max * 100) + '%' }}></span></span><span className="cb-val">{row.actualMedian}h</span></div>
      </div>
      <div className="cycle-foot">median time-to-resolve · {row.savedTotal.toLocaleString()}h saved this period</div>
    </div>
  );
}

function ValidationView({ data, openTask }) {
  // Enrich periods — real data only has {key, count}; views need label/y/m/months
  const enrichedMonths = enrichMonths(data.periods ? data.periods.months : []);
  const enrichedQuarters = enrichQuarters(data.periods ? data.periods.quarters : []);

  const [gran, setGran] = React.useState('month');
  const [monthKey, setMonthKey] = React.useState(
    () => enrichedMonths.length ? enrichedMonths[enrichedMonths.length - 1].key : ''
  );
  const [quarterKey, setQuarterKey] = React.useState(
    () => enrichedQuarters.length ? enrichedQuarters[enrichedQuarters.length - 1].key : ''
  );
  const [catFilter, setCatFilter] = React.useState('all');
  const [outcomeFilter, setOutcomeFilter] = React.useState('all');

  const period = gran === 'month'
    ? enrichedMonths.find(m => m.key === monthKey)
    : enrichedQuarters.find(q => q.key === quarterKey);
  const periodLabel = period ? period.label : '';

  // Filter tickets by period.
  // Note: real resolved.m is 1-indexed (May=5, June=6); period.months (from enrichQuarters)
  // is 0-indexed (Q2=[3,4,5] → April=3, May=4, June=5). Convert before comparing.
  const tickets = (data.tickets || []).filter(t => {
    if (!t.resolved) return false;
    if (gran === 'month') return t.resolved.key === monthKey;
    if (!period) return false;
    const mZero = (t.resolved.m != null) ? t.resolved.m - 1 : -1; // convert 1-indexed → 0-indexed
    return t.resolved.y === period.y && period.months.includes(mZero);
  });

  const v = React.useMemo(() => FV.summarizeTickets(tickets), [tickets]);
  const costRatio = v.verifierCost > 0 ? v.mitigatedCost / v.verifierCost : 0;
  const timeRatio = v.reviewHours > 0 ? v.cycleSaved / v.reviewHours : 0;

  const flags = tickets.flatMap(t => (t.gates || []).filter(g => g.caughtIssues > 0).map(g => ({ ...g, ticket: t })));
  const filtered = flags
    .filter(g => catFilter === 'all' || g.category === catFilter)
    .filter(g => outcomeFilter === 'all' || g.outcome === outcomeFilter)
    .sort((a, b) => (b.ticket.resolved ? b.ticket.resolved.d : 0) - (a.ticket.resolved ? a.ticket.resolved.d : 0));

  const funnel = [
    { label: 'Approved', value: v.approved, color: '#7fae6a' },
    { label: 'Revised', value: v.revised, color: '#c9a857' },
    { label: 'Blocked', value: v.blocked, color: '#e0635a' },
  ];
  const catRows = Object.entries(v.byCategory).map(([name, c]) => ({ name, ...c })).sort((a, b) => b.count - a.count);

  return (
    <div className="view">
      {/* period picker */}
      <div className="period-bar">
        <div className="period-left">
          <span className="period-title">Retrospective</span>
          <div className="seg gran-seg">
            {['month', 'quarter'].map(g => (
              <button key={g} className={'seg-btn' + (gran === g ? ' on' : '')} onClick={() => setGran(g)}>{g}</button>
            ))}
          </div>
          <div className="period-pills">
            {(gran === 'month' ? enrichedMonths : enrichedQuarters).map(p => {
              const active = gran === 'month' ? p.key === monthKey : p.key === quarterKey;
              return <button key={p.key} className={'period-pill' + (active ? ' on' : '')}
                onClick={() => gran === 'month' ? setMonthKey(p.key) : setQuarterKey(p.key)}>{p.label}</button>;
            })}
          </div>
        </div>
        <div className="period-summary">{v.ticketCount} TASKs resolved · {periodLabel}</div>
      </div>

      <div className="panel-row">
        <div className="panel autonomy-panel">
          <div className="panel-head"><h3>Factory autonomy</h3></div>
          <AutonomyGauge rate={v.autonomyRate} />
          <div className="autonomy-legend">
            <div><span className="al-dot" style={{ background: '#7fae6a' }}></span><b>{v.agent}</b> gates cleared by agents</div>
            <div><span className="al-dot" style={{ background: '#b48ee0' }}></span><b>{v.human}</b> escalated to a human</div>
            <div className="al-foot">{v.autonomousTickets} of {v.ticketCount} TASKs ran fully hands-off</div>
          </div>
        </div>

        <div className="panel grow-2">
          <div className="panel-head"><h3>Best-practice ROI of verification</h3><span className="panel-hint">value returned per unit of oversight</span></div>
          {v.mitigatedCost > 0 ? (
            <div className="roi-dual">
              <div className="roi-lane">
                <span className="roi-lane-tag">$ COST</span>
                <div className="roi-eqn">
                  <div className="roi-big"><span className="roi-val">{FV.fmtCost(v.mitigatedCost)}</span><span className="roi-cap">impact mitigated</span></div>
                  <span className="roi-x">÷</span>
                  <div className="roi-big"><span className="roi-val">{FV.fmtCost(v.verifierCost)}</span><span className="roi-cap">verification spend</span></div>
                  <span className="roi-eq">=</span>
                  <div className="roi-big roi-ratio"><span className="roi-val">{costRatio.toFixed(0)}×</span><span className="roi-cap">leverage</span></div>
                </div>
              </div>
              {v.cycleSaved > 0 ? (
                <div className="roi-lane">
                  <span className="roi-lane-tag">⏱ TIME</span>
                  <div className="roi-eqn">
                    <div className="roi-big"><span className="roi-val">{v.cycleSaved.toLocaleString()}h</span><span className="roi-cap">cycle-time saved vs baseline</span></div>
                    <span className="roi-x">÷</span>
                    <div className="roi-big"><span className="roi-val">{v.reviewHours.toFixed(1)}h</span><span className="roi-cap">human review spent</span></div>
                    <span className="roi-eq">=</span>
                    <div className="roi-big roi-ratio"><span className="roi-val">{timeRatio.toFixed(0)}×</span><span className="roi-cap">leverage</span></div>
                  </div>
                </div>
              ) : (
                <div className="reason-note">Cycle-time savings: insufficient data (baseline hours not recorded for this period).</div>
              )}
            </div>
          ) : (
            <div className="reason-note">ROI panel: insufficient data — mitigated-cost not available for TASKs in this period. Gate fidelity is backfill-low; impact values not recorded.</div>
          )}
          <div className="roi-sub">
            <span><b>{v.caughtIssues}</b> issues caught across <b>{v.caughtGates}</b> gates</span>
            {v.speedup > 0 && <span><b>{v.speedup.toFixed(1)}×</b> overall delivery speedup</span>}
          </div>
        </div>
      </div>

      {/* Cycle time before vs after */}
      <div className="panel">
        <div className="panel-head">
          <h3>Cycle time — before vs after AI factory</h3>
          <span className="panel-hint">median time-to-resolve · pre-factory baseline vs current</span>
        </div>
        {v.cycleByType && v.cycleByType.length > 0 ? (
          <>
            <div className="cycle-grid">
              {v.cycleByType.map(row => <CycleRow row={row} key={row.type} />)}
            </div>
            <div className="cycle-total">
              <div><span className="ct-val">{v.baselineTotal.toLocaleString()}h</span><span className="ct-cap">would have taken (baseline)</span></div>
              <span className="roi-x">→</span>
              <div><span className="ct-val">{v.actualTotal.toLocaleString()}h</span><span className="ct-cap">actual with factory</span></div>
              <span className="roi-eq">=</span>
              <div><span className="ct-val" style={{ color: '#7fae6a' }}>{v.cycleSaved.toLocaleString()}h saved</span><span className="ct-cap">{v.speedup.toFixed(1)}× faster delivery</span></div>
            </div>
          </>
        ) : (
          <div className="reason-note">Cycle-time data: insufficient data — baseline hours not recorded for TASKs in this period (backfill-low fidelity). This panel will populate as the collector captures more runs with full telemetry.</div>
        )}
      </div>

      <div className="panel-row">
        <div className="panel">
          <div className="panel-head"><h3>Gate outcomes</h3><span className="panel-hint">{v.gatesTotal} gates · {periodLabel}</span></div>
          <BreakdownBars rows={funnel} unit="count" />
          <div className="reason-stat">
            {v.totalReasoning > 0 ? (
              <>
                <span><b>{FV.fmtTokens(v.totalReasoning)}</b> reasoning tokens</span>
                <span>{(v.reasoningShare * 100).toFixed(0)}% of all tokens spent thinking</span>
              </>
            ) : (
              <span style={{ color: 'var(--faint)' }}>Reasoning-token breakdown not recorded in this period.</span>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Flagged by category</h3><span className="panel-hint">click to filter the log →</span></div>
          <div className="cat-rollup">
            {catRows.length ? catRows.map(c => (
              <button key={c.name} className={'cat-row' + (catFilter === c.name ? ' on' : '')} onClick={() => setCatFilter(catFilter === c.name ? 'all' : c.name)}>
                <span className="cat-chip" style={{ '--cat-c': c.color }}>{c.name}</span>
                <span className="cat-bar-track"><span className="cat-bar-fill" style={{ width: (c.count / Math.max(...catRows.map(x => x.count)) * 100) + '%', background: c.color }}></span></span>
                <span className="cat-stat">{c.count}× · {FV.fmtCost(c.cost)}</span>
              </button>
            )) : <div className="tree-queued-note">No flags in this period.</div>}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Flag log — revised &amp; blocked</h3>
          <div className="log-controls">
            <span className="panel-hint">{periodLabel} · {filtered.length} of {flags.length} flags</span>
            <div className="seg">
              {['all', 'revised', 'blocked'].map(o => (
                <button key={o} className={'seg-btn' + (outcomeFilter === o ? ' on' : '')} onClick={() => setOutcomeFilter(o)}>{o}</button>
              ))}
            </div>
            {catFilter !== 'all' ? <button className="filter-clear" onClick={() => setCatFilter('all')}>✕ {catFilter}</button> : null}
          </div>
        </div>
        <table className="data-table">
          <thead><tr><th>TASK</th><th>Type</th><th>Status</th><th>Category</th><th>Reason &amp; tags</th><th>By</th><th>Impact</th></tr></thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id}>
                <td><span className="feat-key">{g.ticket.key}</span> {g.ticket.title}</td>
                <td><span className={'ttype ttype-' + g.ticket.type.toLowerCase()}>{g.ticket.type}</span></td>
                <td><span className={'flag-status flag-' + g.outcome}>{g.outcome}</span></td>
                <td><span className="cat-chip sm" style={{ '--cat-c': FV.CATEGORIES[g.category] }}>{g.category}</span></td>
                <td className="catch-cell">{g.note}<span className="tag-row">{(g.tags || []).map(t => <span className="tag" key={t}>#{t}</span>)}</span></td>
                <td><span className={'gate-by-' + g.by}>{g.by === 'human' ? '◆ ' + g.verifier : '◇ ' + g.verifier}</span></td>
                <td className="num cost-cell">{g.mitigated != null ? '~' + FV.fmtCost(g.mitigated) : '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 ? <tr><td colSpan="7" style={{ color: 'var(--faint)', textAlign: 'center', padding: '18px' }}>No flags match this filter.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { OverviewView, PipelineView, TaskDetailView, AgentsView, ValidationView });
