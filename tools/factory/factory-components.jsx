// ── Shared UI primitives for the AI Factory dashboard ────────────────────
const { fmtTokens, fmtCost, MODELS, DOMAINS } = window.Factory;

const PRIORITY_COLORS = { P0: '#e0635a', P1: '#d97757', P2: '#c9a857', P3: '#8a8576' };

function PriorityTag({ p }) {
  return (
    <span className="prio-tag" style={{ color: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] + '66' }}>{p}</span>
  );
}

function ModelChip({ model }) {
  const m = MODELS[model];
  if (!m) return <span className="model-chip" style={{ color: 'var(--muted)' }}>{model}</span>;
  return (
    <span className="model-chip" style={{ color: m.color }}>
      <span className="model-dot" style={{ background: m.color }}></span>{m.label}
    </span>
  );
}

function StatusDot({ status }) {
  const map = { done: '#7fae6a', active: '#d97757', running: '#d97757', queued: '#5a564a', shipped: '#7fae6a', 'in-flight': '#d97757' };
  return <span className={'status-dot' + (status === 'active' || status === 'running' ? ' pulsing' : '')} style={{ background: map[status] || '#5a564a' }}></span>;
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : null}>{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

// Stacked daily bar chart (cost by model over N days)
function DailyBars({ days, height }) {
  const h = height || 150;
  const max = Math.max(...days.map(d => (d.opus || 0) + (d.sonnet || 0) + (d.haiku || 0))) * 1.08 || 1;
  return (
    <div className="daily-bars" style={{ height: h }}>
      {days.map((d, i) => {
        const opus = d.opus || 0, sonnet = d.sonnet || 0, haiku = d.haiku || 0;
        const total = opus + sonnet + haiku;
        return (
          <div className="day-col" key={i} title={fmtCost(total)}>
            <div className="day-stack">
              <div className="day-seg" style={{ height: (opus / max) * h, background: MODELS['opus-4.5'].color }}></div>
              <div className="day-seg" style={{ height: (sonnet / max) * h, background: MODELS['sonnet-4.5'].color }}></div>
              <div className="day-seg" style={{ height: (haiku / max) * h, background: MODELS['haiku-4'].color }}></div>
            </div>
            <div className="day-label">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal proportion bar with legend rows
function BreakdownBars({ rows, unit }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="breakdown">
      {rows.map((r, i) => (
        <div className="bk-row" key={i}>
          <div className="bk-name">{r.label}</div>
          <div className="bk-track">
            <div className="bk-fill" style={{ width: (r.value / max * 100) + '%', background: r.color }}></div>
          </div>
          <div className="bk-val">{unit === 'cost' ? fmtCost(r.value) : unit === 'count' ? r.value : fmtTokens(r.value)}</div>
        </div>
      ))}
    </div>
  );
}

// 5-domain progress stepper used on feature cards & detail header
// Works with both domain objects (mock) and domain-id strings (real data — adapted upstream)
function DomainStepper({ feature, size }) {
  const domains = feature.domains || [];
  // Support both adapted domain objects and raw string ids
  const domainObjects = domains.map(d => {
    if (typeof d === 'string') {
      const found = DOMAINS.find(x => x.id === d);
      return found ? { ...found, status: 'done' } : { id: d, short: d.toUpperCase().slice(0, 3), color: 'var(--muted)', status: 'done' };
    }
    return d;
  });
  if (!domainObjects.length) {
    return <div className="stepper" style={{ color: 'var(--faint)', fontSize: '10.5px' }}>no domain data</div>;
  }
  return (
    <div className={'stepper' + (size === 'lg' ? ' stepper-lg' : '')}>
      {domainObjects.map((d, i) => (
        <div className={'step step-' + (d.status || 'queued')} key={d.id || i} style={d.status !== 'queued' ? { '--step-c': d.color } : null}>
          <span className="step-label">{d.short}</span>
        </div>
      ))}
    </div>
  );
}

// ── Spawn tree ────────────────────────────────────────────────────────────
function RunNode({ run, dense }) {
  return (
    <div className={'run-node' + (run.status === 'running' ? ' run-live' : '')}>
      <div className="run-head">
        <StatusDot status={run.status} />
        <span className="run-role">{run.role}</span>
        {run.model ? <ModelChip model={run.model} /> : null}
        {run.retried ? <span className="retry-flag" title="retried after failed verification">↻ retry</span> : null}
      </div>
      {!dense && (
        <div className="run-meta">
          {(run.tokensIn != null && run.tokensOut != null) ? <span>{fmtTokens(run.tokensIn + run.tokensOut)} tok</span> : null}
          {run.cost != null ? <span>{fmtCost(run.cost)}</span> : null}
          {run.durationMin != null ? <span>{run.durationMin}m</span> : null}
        </div>
      )}
      {run.decision ? <div className="run-decision">⌁ {run.decision}</div> : null}
    </div>
  );
}

function GateNode({ gate }) {
  const oc = { approved: '#7fae6a', revised: '#c9a857', blocked: '#e0635a', pending: '#8a8576' }[gate.outcome] || '#8a8576';
  const icon = { approved: '✓', revised: '↻', blocked: '✕', pending: '⋯' }[gate.outcome] || '?';
  return (
    <div className={'gate-node gate-' + gate.by} style={{ '--oc': oc }}>
      <div className="gate-head">
        <span className="gate-badge">{gate.by === 'human' ? '◆ HUMAN GATE' : '◇ AGENT GATE'}</span>
        <span className="gate-outcome" style={{ color: oc }}>{icon} {gate.outcome}</span>
      </div>
      <div className="gate-meta">
        <span>{gate.verifier}</span>
        {gate.humanMinutes != null && gate.humanMinutes > 0 ? <span>· {gate.humanMinutes}m human</span> : null}
        {gate.caughtIssues != null && gate.caughtIssues > 0 ? <span className="gate-caught">· caught {gate.caughtIssues}</span> : null}
        {gate.mitigated != null && gate.mitigated > 0 ? <span className="gate-mit">· ~{fmtCost(gate.mitigated)} mitigated</span> : null}
      </div>
      <div className="gate-note">⌁ {gate.note}{gate.category ? <span className="cat-chip sm" style={{ '--cat-c': (window.Factory.CATEGORIES[gate.category] || 'var(--muted)') }}>{gate.category}</span> : null}</div>
    </div>
  );
}

function SpawnTree({ feature, dense }) {
  // Real data: domains is an array of domain-id strings; tasks/runs are not present
  // Mock data: domains is an array of domain objects with tasks/runs
  const rawDomains = feature.domains || [];
  const hasDomainObjects = rawDomains.length > 0 && typeof rawDomains[0] === 'object' && rawDomains[0] !== null;

  if (!hasDomainObjects) {
    // Real data path: domains is string[] of agent-territory ids
    const gates = feature.gates || [];
    return (
      <div className="spawn-tree">
        <div className="tree-root">
          <div className="run-node root-node">
            <div className="run-head">
              <StatusDot status={feature.status === 'shipped' ? 'done' : 'in-flight'} />
              <span className="run-role">orchestrator</span>
              <ModelChip model="opus-4.5" />
            </div>
            <div className="run-decision">⌁ {feature.key} · {rawDomains.length} agent-territory run{rawDomains.length !== 1 ? 's' : ''} recorded</div>
          </div>
        </div>
        <div className="tree-branches">
          {rawDomains.map((domId, i) => {
            const domMeta = DOMAINS.find(d => d.id === domId) || { id: domId, label: domId, color: 'var(--muted)' };
            const gate = gates.find(g => g.domainId === domId);
            return (
              <div className="tree-domain" key={domId + i} style={{ '--dom-c': domMeta.color }}>
                <div className="tree-domain-head">
                  <span className="tree-domain-name">{domMeta.label}</span>
                  <span className="tree-domain-stat">{gate ? '1 gate' : 'no gate'}</span>
                </div>
                <div className="tree-tasks">
                  <div className="tree-queued-note" style={{ color: 'var(--muted)' }}>
                    Run details not available in this data fidelity.
                  </div>
                  {gate ? <GateNode gate={gate} /> : null}
                </div>
              </div>
            );
          })}
          {rawDomains.length === 0 && (
            <div className="tree-queued-note">No domain runs recorded for this TASK.</div>
          )}
        </div>
      </div>
    );
  }

  // Mock / full-fidelity data path: domains are objects with tasks/runs
  const activeDomains = rawDomains.filter(d => d.status !== 'queued');
  const gateFor = (id) => (feature.gates || []).find(g => g.domainId === id);
  return (
    <div className="spawn-tree">
      <div className="tree-root">
        <div className="run-node root-node">
          <div className="run-head">
            <StatusDot status={feature.status === 'shipped' ? 'done' : 'running'} />
            <span className="run-role">orchestrator</span>
            <ModelChip model="opus-4.5" />
          </div>
          <div className="run-decision">⌁ decomposed {feature.key} into {rawDomains.reduce((s, d) => s + (d.tasks ? d.tasks.length : 0), 0)} tasks across {activeDomains.length} active domain{activeDomains.length === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div className="tree-branches">
        {activeDomains.map(dom => (
          <div className="tree-domain" key={dom.id} style={{ '--dom-c': dom.color }}>
            <div className="tree-domain-head">
              <span className="tree-domain-name">{dom.label}</span>
              <span className="tree-domain-stat">{dom.tasks ? dom.tasks.reduce((s, t) => s + t.runs.length, 0) : 0} runs</span>
            </div>
            <div className="tree-tasks">
              {(dom.tasks || []).filter(t => t.runs && t.runs.length > 0).map(task => (
                <div className="tree-task" key={task.id}>
                  <div className="tree-task-head">
                    <span className="tree-task-name">{task.name}</span>
                    <span className="diff-pips" title={'difficulty ' + task.difficulty + '/5'}>
                      {[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= task.difficulty ? 'pip on' : 'pip'}></i>)}
                    </span>
                    <PriorityTag p={task.priority} />
                  </div>
                  {task.runs.map(run => <RunNode run={run} key={run.id} dense={dense} />)}
                </div>
              ))}
              {dom.tasks && dom.tasks.filter(t => !t.runs || t.runs.length === 0).length > 0 && (
                <div className="tree-queued-note">{dom.tasks.filter(t => !t.runs || t.runs.length === 0).length} task(s) queued</div>
              )}
              {gateFor(dom.id) ? <GateNode gate={gateFor(dom.id)} /> : null}
            </div>
          </div>
        ))}
        {activeDomains.length === 0 && <div className="tree-queued-note">No agents spawned yet — TASK is queued.</div>}
      </div>
    </div>
  );
}

// Autonomy gauge: semicircle showing % of gates cleared without a human
function AutonomyGauge({ rate }) {
  const pct = Math.round(rate * 100);
  const R = 70, C = Math.PI * R;
  const off = C * (1 - rate);
  return (
    <div className="gauge">
      <svg viewBox="0 0 170 95" width="100%">
        <path d="M15 88 A70 70 0 0 1 155 88" fill="none" stroke="var(--panel-2)" strokeWidth="14" />
        <path d="M15 88 A70 70 0 0 1 155 88" fill="none" stroke="#7fae6a" strokeWidth="14"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} />
      </svg>
      <div className="gauge-center">
        <div className="gauge-pct">{pct}<span>%</span></div>
        <div className="gauge-cap">autonomous</div>
      </div>
    </div>
  );
}

Object.assign(window, { PriorityTag, ModelChip, StatusDot, StatCard, DailyBars, BreakdownBars, DomainStepper, SpawnTree, GateNode, AutonomyGauge, PRIORITY_COLORS });
