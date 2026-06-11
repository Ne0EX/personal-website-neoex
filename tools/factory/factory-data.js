// ── AI Factory mock data model ────────────────────────────────────────────
// Deterministic (seeded) generator so the prototype is stable across reloads.

(function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DOMAINS = [
    { id: 'product',     label: 'Product',     short: 'PRD', color: '#b48ee0' },
    { id: 'design',      label: 'Design',      short: 'DSN', color: '#6a9bcc' },
    { id: 'engineering', label: 'Engineering', short: 'ENG', color: '#d97757' },
    { id: 'qa',          label: 'QA',          short: 'QA',  color: '#c9a857' },
    { id: 'deploy',      label: 'Deploy',      short: 'DEP', color: '#7fae6a' },
  ];

  const MODELS = {
    'opus-4.5':   { label: 'claude-opus-4-5',   tier: 3, inPrice: 15.0, outPrice: 75.0, color: '#d97757' },
    'sonnet-4.5': { label: 'claude-sonnet-4-5', tier: 2, inPrice: 3.0,  outPrice: 15.0, color: '#6a9bcc' },
    'haiku-4':    { label: 'claude-haiku-4',    tier: 1, inPrice: 0.8,  outPrice: 4.0,  color: '#7fae6a' },
  };

  const ROLES = [
    { id: 'orchestrator',     domain: null,          model: 'opus-4.5' },
    { id: 'product-analyst',  domain: 'product',     model: 'sonnet-4.5' },
    { id: 'spec-writer',      domain: 'product',     model: 'sonnet-4.5' },
    { id: 'scope-estimator',  domain: 'product',     model: 'haiku-4' },
    { id: 'ux-architect',     domain: 'design',      model: 'opus-4.5' },
    { id: 'ui-designer',      domain: 'design',      model: 'sonnet-4.5' },
    { id: 'copy-writer',      domain: 'design',      model: 'haiku-4' },
    { id: 'system-architect', domain: 'engineering', model: 'opus-4.5' },
    { id: 'backend-dev',      domain: 'engineering', model: 'sonnet-4.5' },
    { id: 'frontend-dev',     domain: 'engineering', model: 'sonnet-4.5' },
    { id: 'code-reviewer',    domain: 'engineering', model: 'opus-4.5' },
    { id: 'test-writer',      domain: 'qa',          model: 'sonnet-4.5' },
    { id: 'qa-runner',        domain: 'qa',          model: 'haiku-4' },
    { id: 'security-auditor', domain: 'qa',          model: 'opus-4.5' },
    { id: 'release-manager',  domain: 'deploy',      model: 'sonnet-4.5' },
    { id: 'sre-monitor',      domain: 'deploy',      model: 'haiku-4' },
  ];

  const FEATURE_TITLES = [
    'Threaded replies in community feed',
    'Story reactions & quick emotes',
    'Moderation auto-triage queue',
    'Live event co-watching rooms',
    'Creator analytics digest',
    'Push notification batching engine',
    'Profile badges & reputation tiers',
    'Cross-community content sharing',
    'Smart reply suggestions in chat',
    'Scheduled posts & content calendar',
    'Spam-cluster detection pipeline',
    'Voice notes in direct messages',
    'Onboarding interest graph picker',
    'Poll & quiz post composer',
    'Search relevance re-ranker',
    'Group call screen sharing',
    'Content translation layer',
    'Member churn early-warning signals',
    'Reusable webhook subscriptions',
    'Media CDN cost optimizer',
    'Accessibility audit sweep',
    'Rate-limit self-service console',
    'Session replay privacy masking',
    'Sticker marketplace MVP',
  ];

  const TASK_TEMPLATES = {
    product:     ['Mine support tickets for demand signals', 'Draft PRD & success metrics', 'Competitive scan', 'Scope & milestone breakdown', 'Edge-case requirement sweep'],
    design:      ['User flow mapping', 'Hi-fi screen designs', 'Component spec & tokens', 'Interaction & motion spec', 'UX copy pass'],
    engineering: ['API & schema design', 'Backend service implementation', 'Client UI implementation', 'Data migration script', 'Code review & hardening'],
    qa:          ['Test plan authoring', 'Unit & integration test suite', 'Regression sweep', 'Security & privacy audit', 'Load test scenarios'],
    deploy:      ['Staged rollout plan', 'Canary deploy & verification', 'Dashboard & alert wiring', 'Post-deploy health watch'],
  };

  const HUMAN_PERSONAS = ['M. Chen (EM)', 'R. Okafor (Staff)', 'L. Park (Sec)', 'D. Alvarez (SRE)', 'You'];
  const GATE_PASS = ['output matched spec & eval gates', 'auto-checks green; no regressions', 'within risk budget — approved', 'diff reviewed, no concerns'];

  // Catch library: each revised/blocked reason carries a category + tags for retro rollups
  const CATEGORIES = {
    'Security':      '#e0635a',
    'Privacy':       '#b48ee0',
    'Performance':   '#6a9bcc',
    'Correctness':   '#c9a857',
    'Reliability':   '#7fae6a',
    'Scope':         '#d97757',
    'Accessibility': '#6ac6c9',
    'Consistency':   '#9aa86a',
    'Observability': '#c98a57',
    'Safety':        '#e07a9b',
  };
  const CATCH_LIB = {
    product: [
      { note: 'scope creep — trimmed 2 requirements', cat: 'Scope', tags: ['requirements', 'scope-cut'] },
      { note: 'success metric was unmeasurable; reframed', cat: 'Scope', tags: ['metrics'] },
      { note: 'missing edge-case requirement', cat: 'Correctness', tags: ['edge-case'] },
    ],
    design: [
      { note: 'accessibility contrast failures', cat: 'Accessibility', tags: ['a11y', 'contrast'] },
      { note: 'flow dead-end on error state', cat: 'Correctness', tags: ['ux', 'error-state'] },
      { note: 'token drift from design system', cat: 'Consistency', tags: ['design-system'] },
    ],
    engineering: [
      { note: 'N+1 query in hot path', cat: 'Performance', tags: ['db', 'perf'] },
      { note: 'unhandled null on auth boundary', cat: 'Correctness', tags: ['auth', 'npe'] },
      { note: 'race condition in retry logic', cat: 'Reliability', tags: ['concurrency'] },
      { note: 'secret almost committed to repo', cat: 'Security', tags: ['secrets', 'leak'] },
    ],
    qa: [
      { note: 'flaky test masked a real failure', cat: 'Reliability', tags: ['flaky', 'tests'] },
      { note: 'PII unmasked in logs', cat: 'Privacy', tags: ['pii', 'logging'] },
      { note: 'load test exposed memory leak', cat: 'Performance', tags: ['memory', 'load'] },
      { note: 'security: IDOR on share endpoint', cat: 'Security', tags: ['idor', 'authz'] },
    ],
    deploy: [
      { note: 'canary error-rate spike — rolled back', cat: 'Reliability', tags: ['canary', 'rollback'] },
      { note: 'missing migration rollback path', cat: 'Reliability', tags: ['migration'] },
      { note: 'alert thresholds mis-set', cat: 'Observability', tags: ['alerts'] },
      { note: 'feature flag defaulted on for all', cat: 'Safety', tags: ['flags', 'rollout'] },
    ],
  };

  const DECISIONS = {
    3: ['novel architecture decisions; routed to top tier', 'high blast radius — review depth prioritized over cost', 'ambiguous spec requires deep reasoning', 'security-critical path; max capability mandated by policy'],
    2: ['standard generation task within known patterns', 'difficulty 3/5 — mid tier clears eval threshold (94%)', 'structured output against an existing spec', 'cost-balanced default for this role'],
    1: ['mechanical transform; cheapest tier passes evals', 'high-volume low-risk task — optimized for cost', 'simple validation against checklist', 'repetitive sweep; latency favored over depth'],
  };

  // JIRA ticket types: baseHours = median time-to-resolve BEFORE the AI factory
  // (from historical Jira lead time). actualHours = baseHours × factor (after factory).
  const TICKET_TYPES = {
    'Bug':     { baseHours: 26,  fLo: 0.30, fHi: 0.58, weight: 0.48, costBase: 14 },
    'Feature': { baseHours: 148, fLo: 0.26, fHi: 0.52, weight: 0.40, costBase: 95 },
    'Project': { baseHours: 612, fLo: 0.34, fHi: 0.60, weight: 0.12, costBase: 520 },
  };

  // Build one verification gate for a domain (shared by live features + historical tickets)
  function buildGate(rnd, idp, dom, di, priority, maxDiff, isActive) {
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const policyHuman = (dom.id === 'deploy' && rnd() < 0.55) || (dom.id === 'qa' && rnd() < 0.55);
    const riskHuman = maxDiff >= 4 && parseInt(priority[1]) <= 1;
    const escalated = policyHuman || riskHuman || rnd() < 0.18;
    const by = escalated ? 'human' : 'agent';
    let outcome = 'approved';
    const roll = rnd();
    if (roll < (escalated ? 0.34 : 0.22)) outcome = 'revised';
    if (roll < 0.05) outcome = 'blocked';
    if (isActive) outcome = 'pending';
    const caughtIssues = (outcome === 'approved' || outcome === 'pending') ? 0 : ri(1, 4);
    const riskMult = { product: 0.6, design: 0.7, engineering: 1.6, qa: 1.3, deploy: 2.4 }[dom.id];
    const mitigated = caughtIssues > 0 ? (ri(40, 220) * riskMult * maxDiff) : 0;
    const humanMinutes = by === 'human' ? (outcome === 'approved' ? ri(3, 12) : ri(10, 45)) : 0;
    const verifierRole = dom.id === 'qa' ? 'security-auditor' : dom.id === 'engineering' ? 'code-reviewer' : 'agent-verifier';
    const catch_ = caughtIssues > 0 ? pick(CATCH_LIB[dom.id] || CATCH_LIB.engineering) : null;
    return {
      id: idp + '-' + di, domainId: dom.id, domainLabel: dom.label, domainColor: dom.color,
      by, verifier: by === 'human' ? pick(HUMAN_PERSONAS) : verifierRole,
      outcome, caughtIssues, mitigated, humanMinutes,
      category: catch_ ? catch_.cat : null, tags: catch_ ? catch_.tags : [],
      note: outcome === 'approved' ? pick(GATE_PASS) : outcome === 'pending' ? 'awaiting verification' : (catch_ ? catch_.note : ''),
    };
  }

  function fmtTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  }
  function fmtCost(n) {
    if (n >= 1000) return '$' + (n / 1000).toFixed(2) + 'k';
    if (n >= 100) return '$' + n.toFixed(0);
    return '$' + n.toFixed(2);
  }

  function generate(featureCount, seed) {
    const rnd = mulberry32(seed || 42);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

    const features = [];
    for (let f = 0; f < featureCount; f++) {
      const title = FEATURE_TITLES[f % FEATURE_TITLES.length];
      const priority = 'P' + ri(0, 3);
      // progress: which domain index the feature has reached
      const reach = ri(0, 5); // 5 = shipped
      const shipped = reach === 5;
      const domains = [];
      let featTokens = 0, featCost = 0, runCount = 0;

      DOMAINS.forEach((dom, di) => {
        let status = 'queued';
        if (di < reach) status = 'done';
        else if (di === reach && !shipped) status = 'active';
        else if (shipped) status = 'done';

        const taskPool = TASK_TEMPLATES[dom.id];
        const nTasks = status === 'queued' ? ri(2, 3) : ri(2, Math.min(4, taskPool.length));
        const tasks = [];
        const used = new Set();
        for (let t = 0; t < nTasks; t++) {
          let name; let guard = 0;
          do { name = pick(taskPool); } while (used.has(name) && ++guard < 10);
          used.add(name);
          const difficulty = ri(1, 5);
          let tStatus = status === 'done' ? 'done' : status === 'queued' ? 'queued'
            : (t === 0 ? 'active' : (rnd() < 0.5 ? 'done' : 'queued'));
          if (status === 'done') tStatus = 'done';
          const runs = [];
          if (tStatus !== 'queued') {
            const domRoles = ROLES.filter(r => r.domain === dom.id);
            const nRuns = tStatus === 'done' ? ri(1, 2) : 1;
            for (let r = 0; r < nRuns; r++) {
              const role = pick(domRoles);
              // escalate model with difficulty sometimes
              let model = role.model;
              if (difficulty >= 5 && MODELS[model].tier < 3 && rnd() < 0.6) model = 'opus-4.5';
              if (difficulty <= 1 && MODELS[model].tier > 1 && rnd() < 0.5) model = 'haiku-4';
              const tier = MODELS[model].tier;
              const tokensIn = ri(8, 90) * 1000 * tier;
              const tokensOut = ri(2, 18) * 1000 * tier;
              const cost = (tokensIn * MODELS[model].inPrice + tokensOut * MODELS[model].outPrice) / 1e6;
              const retried = rnd() < 0.12;
              // extended-thinking tokens: a portion of output, deeper for higher tier + difficulty
              const reasonShare = Math.min(0.7, (0.12 + tier * 0.1 + difficulty * 0.04) * (0.7 + rnd() * 0.6));
              const reasoningTokens = Math.round(tokensOut * reasonShare);
              runs.push({
                id: 'run-' + f + '-' + di + '-' + t + '-' + r,
                role: role.id, model, tokensIn, tokensOut, reasoningTokens,
                cost, durationMin: ri(2, 38),
                status: r === nRuns - 1 && tStatus === 'active' ? 'running' : 'done',
                retried,
                decision: pick(DECISIONS[tier]),
              });
              featTokens += tokensIn + tokensOut;
              featCost += cost;
              runCount++;
            }
          }
          tasks.push({
            id: 'task-' + f + '-' + di + '-' + t,
            name, difficulty, status: tStatus,
            priority: rnd() < 0.3 ? priority : 'P' + Math.min(3, parseInt(priority[1]) + 1),
            runs,
          });
        }
        domains.push({ ...dom, status, tasks });
      });

      // ── verification gates: one checkpoint per domain that has run ──
      const gates = [];
      domains.forEach((dom, di) => {
        if (dom.status === 'queued') return;
        const maxDiff = Math.max(1, ...dom.tasks.map(tk => tk.difficulty));
        // policy: deploy + qa + high-difficulty/high-priority escalate to a human
        const policyHuman = (dom.id === 'deploy' && rnd() < 0.55) || (dom.id === 'qa' && rnd() < 0.6);
        const riskHuman = maxDiff >= 4 && parseInt(priority[1]) <= 1;
        const escalated = policyHuman || riskHuman || rnd() < 0.18;
        const by = escalated ? 'human' : 'agent';
        // outcome: most pass; some get sent back; rare hard block
        let outcome = 'approved';
        const caughtRoll = rnd();
        if (caughtRoll < (escalated ? 0.34 : 0.22)) outcome = 'revised';
        if (caughtRoll < 0.05) outcome = 'blocked';
        if (dom.status === 'active') outcome = 'pending';
        const caughtIssues = outcome === 'approved' || outcome === 'pending' ? 0 : ri(1, 4);
        // impact mitigated when something is caught: scaled by domain risk + difficulty
        const riskMult = { product: 0.6, design: 0.7, engineering: 1.6, qa: 1.3, deploy: 2.4 }[dom.id];
        const mitigated = caughtIssues > 0 ? (ri(40, 220) * riskMult * maxDiff) : 0;
        // time avoided: rework / incident-response hours that the catch prevented
        const mitigatedHours = caughtIssues > 0 ? Math.round(ri(2, 9) * riskMult * (maxDiff / 3) * 10) / 10 : 0;
        const humanMinutes = by === 'human' ? (outcome === 'approved' ? ri(3, 12) : ri(10, 45)) : 0;
        const verifierRole = dom.id === 'qa' ? 'security-auditor' : dom.id === 'engineering' ? 'code-reviewer' : 'agent-verifier';
        const catch_ = caughtIssues > 0 ? pick(CATCH_LIB[dom.id] || CATCH_LIB.engineering) : null;
        gates.push({
          id: 'gate-' + f + '-' + di,
          domainId: dom.id, domainLabel: dom.label, domainColor: dom.color,
          by, verifier: by === 'human' ? pick(HUMAN_PERSONAS) : verifierRole,
          outcome, caughtIssues, mitigated, mitigatedHours, humanMinutes,
          category: catch_ ? catch_.cat : null,
          tags: catch_ ? catch_.tags : [],
          daysAgo: ri(0, 27),
          note: outcome === 'approved' ? pick(GATE_PASS) : outcome === 'pending' ? 'awaiting verification' : (catch_ ? catch_.note : ''),
        });
      });
      const featReasoning = domains.reduce((s, d) => s + d.tasks.reduce((s2, tk) => s2 + tk.runs.reduce((s3, run) => s3 + run.reasoningTokens, 0), 0), 0);

      // ticket classification + Jira cycle-time (baseline vs actual)
      const tRoll = rnd();
      const ticketType = tRoll < 0.48 ? 'Bug' : tRoll < 0.88 ? 'Feature' : 'Project';
      const tt = TICKET_TYPES[ticketType];
      const baselineHours = Math.round(tt.baseHours * (0.75 + rnd() * 0.55));
      const actualHours = Math.round(baselineHours * (tt.fLo + rnd() * (tt.fHi - tt.fLo)));
      const hoursSaved = Math.max(0, baselineHours - actualHours);

      features.push({
        id: 'feat-' + f,
        key: 'FCT-' + (104 + f * 7),
        title, priority, ticketType,
        baselineHours, actualHours, hoursSaved,
        status: shipped ? 'shipped' : 'in-flight',
        reach, domains, gates,
        tokens: featTokens, cost: featCost, runs: runCount, reasoningTokens: featReasoning,
        autonomous: gates.length > 0 && gates.every(g => g.by === 'agent'),
        ageDays: ri(1, 21),
      });
    }

    // aggregates
    const byModel = {}, byRole = {}, byDomain = {};
    Object.keys(MODELS).forEach(m => byModel[m] = { tokens: 0, cost: 0, calls: 0 });
    ROLES.forEach(r => byRole[r.id] = { tokens: 0, cost: 0, calls: 0, running: 0, domain: r.domain });
    DOMAINS.forEach(d => byDomain[d.id] = { tokens: 0, cost: 0, calls: 0 });

    features.forEach(ft => ft.domains.forEach(dom => dom.tasks.forEach(tk => tk.runs.forEach(run => {
      const tok = run.tokensIn + run.tokensOut;
      byModel[run.model].tokens += tok; byModel[run.model].cost += run.cost; byModel[run.model].calls++;
      byRole[run.role].tokens += tok; byRole[run.role].cost += run.cost; byRole[run.role].calls++;
      if (run.status === 'running') byRole[run.role].running++;
      byDomain[dom.id].tokens += tok; byDomain[dom.id].cost += run.cost; byDomain[dom.id].calls++;
    }))));

    // orchestrator overhead ~8% of total
    const totalCost0 = Object.values(byModel).reduce((s, m) => s + m.cost, 0);
    const orchCost = totalCost0 * 0.08;
    const orchTokens = Math.round(features.length * 220000 * (0.8 + rnd() * 0.4));
    byRole['orchestrator'] = { tokens: orchTokens, cost: orchCost, calls: features.length * 3, running: features.filter(f => f.status === 'in-flight').length, domain: null };
    byModel['opus-4.5'].tokens += orchTokens; byModel['opus-4.5'].cost += orchCost; byModel['opus-4.5'].calls += features.length * 3;

    // ── reasoning + gate / human-in-the-loop aggregates ──
    const allGates = features.flatMap(ft => ft.gates);
    const decided = allGates.filter(g => g.outcome !== 'pending');
    const humanGates = decided.filter(g => g.by === 'human');
    const agentGates = decided.filter(g => g.by === 'agent');
    const caught = decided.filter(g => g.caughtIssues > 0);
    const reasoningTokens = features.reduce((s, ft) => s + ft.reasoningTokens, 0);
    const reasoningByModel = {};
    Object.keys(MODELS).forEach(m => reasoningByModel[m] = 0);
    features.forEach(ft => ft.domains.forEach(dom => dom.tasks.forEach(tk => tk.runs.forEach(run => {
      reasoningByModel[run.model] += run.reasoningTokens;
    }))));
    const mitigatedCost = caught.reduce((s, g) => s + g.mitigated, 0);
    const mitigatedHours = caught.reduce((s, g) => s + g.mitigatedHours, 0);
    const humanMinutes = humanGates.reduce((s, g) => s + g.humanMinutes, 0);
    const reviewHours = humanMinutes / 60 + agentGates.length * 0.05; // human review + agent verify wall-time
    // category rollup for monthly/quarterly retro
    const byCategory = {};
    caught.forEach(g => {
      if (!g.category) return;
      if (!byCategory[g.category]) byCategory[g.category] = { count: 0, cost: 0, hours: 0, color: CATEGORIES[g.category] };
      byCategory[g.category].count += 1;
      byCategory[g.category].cost += g.mitigated;
      byCategory[g.category].hours += g.mitigatedHours;
    });

    const validation = {
      gatesTotal: decided.length,
      pending: allGates.length - decided.length,
      human: humanGates.length,
      agent: agentGates.length,
      autonomyRate: decided.length ? agentGates.length / decided.length : 0,
      approved: decided.filter(g => g.outcome === 'approved').length,
      revised: decided.filter(g => g.outcome === 'revised').length,
      blocked: decided.filter(g => g.outcome === 'blocked').length,
      caughtGates: caught.length,
      caughtIssues: caught.reduce((s, g) => s + g.caughtIssues, 0),
      mitigatedCost,
      mitigatedHours,
      humanMinutes,
      humanHours: humanMinutes / 60,
      reviewHours,
      autonomousFeatures: features.filter(f => f.autonomous).length,
      reasoningTokens,
      reasoningByModel,
      byCategory,
      // best-practice ROI in two currencies: money and time
      verifierCost: agentGates.length * 3.5 + humanMinutes * 2, // $: agent compute + loaded human labor ($2/min)
    };

    const totals = {
      tokens: Object.values(byModel).reduce((s, m) => s + m.tokens, 0),
      cost: Object.values(byModel).reduce((s, m) => s + m.cost, 0),
      calls: Object.values(byModel).reduce((s, m) => s + m.calls, 0),
      running: Object.values(byRole).reduce((s, r) => s + r.running, 0),
      inFlight: features.filter(f => f.status === 'in-flight').length,
      shipped: features.filter(f => f.status === 'shipped').length,
    };

    // 14-day daily cost series, split by model
    const days = [];
    const labels = ['28', '29', '30', '31', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
    for (let d = 0; d < 14; d++) {
      const base = totals.cost / 14;
      const wave = 0.55 + 0.9 * rnd() + (d > 9 ? 0.25 : 0);
      const dayCost = base * wave;
      days.push({
        label: labels[d],
        opus: dayCost * (0.38 + rnd() * 0.18),
        sonnet: dayCost * (0.3 + rnd() * 0.14),
        haiku: dayCost * (0.05 + rnd() * 0.05),
      });
    }

    // ── historical resolved tickets (6 months) for the retro / period picker ──
    // "today" = Jun 10 2026 → months Jan..Jun 2026, quarters Q1 & Q2 2026
    const NOW = { y: 2026, m: 5, d: 10 };
    const monthMeta = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(2026, 5, 1); dt.setMonth(dt.getMonth() - i);
      const y = dt.getFullYear(), m = dt.getMonth();
      const last = (y === NOW.y && m === NOW.m) ? NOW.d : new Date(y, m + 1, 0).getDate();
      monthMeta.push({ y, m, lastDay: last,
        key: y + '-' + String(m + 1).padStart(2, '0'),
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] + ' ' + y });
    }
    const TITLE_POOL = FEATURE_TITLES;
    const BUG_TITLES = ['Crash on empty feed pull-to-refresh', 'Avatar upload fails over 5MB', 'Notification dedupe off-by-one', 'Stale unread badge after logout', 'Emoji picker freezes on Android 12', 'Duplicate webhook deliveries', 'Search returns soft-deleted posts', 'Timezone drift in scheduled posts', 'Memory leak in live room socket', 'Rate-limit header miscounted', 'Deep link 404 on shared story', 'Poll votes double-counted on retry'];

    const tickets = [];
    let tk = 0;
    monthMeta.forEach((mm, mi) => {
      const n = (mi === monthMeta.length - 1) ? ri(6, 10) : ri(14, 22); // current month partial
      for (let i = 0; i < n; i++) {
        const tRoll = rnd();
        const type = tRoll < TICKET_TYPES.Bug.weight ? 'Bug'
          : tRoll < TICKET_TYPES.Bug.weight + TICKET_TYPES.Feature.weight ? 'Feature' : 'Project';
        const tt = TICKET_TYPES[type];
        const difficulty = type === 'Project' ? ri(3, 5) : type === 'Feature' ? ri(2, 5) : ri(1, 4);
        const priority = 'P' + ri(0, 3);
        const baselineHours = Math.round(tt.baseHours * (0.72 + rnd() * 0.6));
        const actualHours = Math.round(baselineHours * (tt.fLo + rnd() * (tt.fHi - tt.fLo)));
        const hoursSaved = Math.max(0, baselineHours - actualHours);
        const day = 1 + Math.floor(rnd() * mm.lastDay);
        const resolved = { y: mm.y, m: mm.m, d: day, key: mm.key, label: mm.label };
        const sizeMult = type === 'Project' ? 4.2 : type === 'Feature' ? 1.6 : 0.5;
        const cost = tt.costBase * (0.6 + rnd() * 0.9);
        const tokens = Math.round((180000 + rnd() * 900000) * sizeMult);
        const reasoningTokens = Math.round(tokens * (0.08 + rnd() * 0.1));
        // gates: every domain ran (ticket is resolved)
        const gates = DOMAINS.map((dom, di) => buildGate(rnd, 'tk' + tk + '-' + di, dom, di, priority, difficulty, false));
        const title = type === 'Bug' ? BUG_TITLES[(tk) % BUG_TITLES.length] : TITLE_POOL[(tk * 3) % TITLE_POOL.length];
        tickets.push({
          id: 'tk-' + tk, key: 'FCT-' + (1200 + tk * 3),
          title, type, priority, difficulty,
          baselineHours, actualHours, hoursSaved,
          cost, tokens, reasoningTokens, gates, resolved,
          autonomous: gates.every(g => g.by === 'agent'),
        });
        tk++;
      }
    });

    const periods = {
      months: monthMeta.map(m => ({ key: m.key, label: m.label, y: m.y, m: m.m })),
      quarters: [
        { key: '2026-Q1', label: 'Q1 2026', y: 2026, months: [0, 1, 2] },
        { key: '2026-Q2', label: 'Q2 2026', y: 2026, months: [3, 4, 5] },
      ],
    };

    return { features, byModel, byRole, byDomain, totals, days, validation, tickets, periods };
  }

  function median(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
  }

  // Roll up a set of resolved tickets into retro metrics (period-filtered upstream)
  function summarizeTickets(tickets) {
    const gates = tickets.flatMap(t => t.gates);
    const agentGates = gates.filter(g => g.by === 'agent');
    const humanGates = gates.filter(g => g.by === 'human');
    const caught = gates.filter(g => g.caughtIssues > 0);
    const humanMinutes = humanGates.reduce((s, g) => s + (g.humanMinutes || 0), 0);
    const mitigatedCost = caught.reduce((s, g) => s + (g.mitigated || 0), 0);
    const verifierCost = agentGates.length * 3.5 + humanMinutes * 2;
    const reviewHours = humanMinutes / 60 + agentGates.length * 0.05;

    const byCategory = {};
    caught.forEach(g => {
      if (!g.category) return;
      if (!byCategory[g.category]) byCategory[g.category] = { count: 0, cost: 0, color: CATEGORIES[g.category] };
      byCategory[g.category].count += 1;
      byCategory[g.category].cost += (g.mitigated || 0);
    });

    // Jira cycle time: baseline (pre-factory) vs actual (after), by ticket type
    const cycleByType = Object.keys(TICKET_TYPES).map(type => {
      const ts = tickets.filter(t => t.type === type && t.baselineHours != null && t.actualHours != null);
      if (!ts.length) return null;
      const baseMed = median(ts.map(t => t.baselineHours));
      const actMed = median(ts.map(t => t.actualHours));
      return {
        type, count: ts.length,
        baselineMedian: baseMed, actualMedian: actMed,
        speedup: actMed ? baseMed / actMed : 0,
        savedTotal: ts.reduce((s, t) => s + (t.hoursSaved || 0), 0),
      };
    }).filter(Boolean);

    const ticketsWithHours = tickets.filter(t => t.baselineHours != null && t.actualHours != null);
    const baselineTotal = ticketsWithHours.reduce((s, t) => s + t.baselineHours, 0);
    const actualTotal = ticketsWithHours.reduce((s, t) => s + t.actualHours, 0);
    const cycleSaved = ticketsWithHours.reduce((s, t) => s + (t.hoursSaved || 0), 0);
    const totalReasoning = tickets.reduce((s, t) => s + (t.reasoningTokens || 0), 0);
    const totalTokens = tickets.reduce((s, t) => s + (t.tokens || 0), 0);

    return {
      ticketCount: tickets.length,
      gatesTotal: gates.length,
      human: humanGates.length, agent: agentGates.length,
      autonomyRate: gates.length ? agentGates.length / gates.length : 0,
      autonomousTickets: tickets.filter(t => t.autonomous).length,
      approved: gates.filter(g => g.outcome === 'approved').length,
      revised: gates.filter(g => g.outcome === 'revised').length,
      blocked: gates.filter(g => g.outcome === 'blocked').length,
      caughtGates: caught.length,
      caughtIssues: caught.reduce((s, g) => s + (g.caughtIssues || 0), 0),
      mitigatedCost, verifierCost, humanMinutes, humanHours: humanMinutes / 60, reviewHours,
      byCategory, cycleByType,
      baselineTotal, actualTotal, cycleSaved,
      speedup: actualTotal ? baselineTotal / actualTotal : 0,
      totalCost: tickets.reduce((s, t) => s + (t.cost || 0), 0),
      totalTokens, totalReasoning,
      reasoningShare: totalTokens ? totalReasoning / totalTokens : 0,
    };
  }

  window.Factory = { DOMAINS, MODELS, ROLES, CATEGORIES, TICKET_TYPES, generate, summarizeTickets, fmtTokens, fmtCost };
})();
