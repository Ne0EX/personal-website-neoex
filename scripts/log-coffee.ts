#!/usr/bin/env npx tsx
/**
 * log-coffee.ts — deterministic Airtable coffee log writer
 *
 * Usage:
 *   npx tsx scripts/log-coffee.ts \
 *     --bean "Janson Natural Cold Room Wave x Auction" \
 *     --grind 24 \
 *     --temp 93 \
 *     --ratio "1:15" \
 *     --water 200 \
 *     --taste "plum, blackcurrant, silky, clean" \
 *     [--farm "Janson"] \
 *     [--lot "Wave x Auction"] \
 *     [--variety "Geisha"] \
 *     [--water-formula "Aquacode"] \
 *     [--dripper "Kinto Ceramic 4 cups"] \
 *     [--paper "Kinto"] \
 *     [--method "Filter Drip"] \
 *     [--pour "00:00 — 40g bloom\n00:35 — 120g\n01:10 — 200g"] \
 *     [--improve "next time 24 click, reduce temp to 92"] \
 *     [--status "Done"] \
 *     [--date "2026-06-09"]
 *
 * Token: set AT_TOKEN env var.
 * Bean lookup: shows top matches for disambiguation; prompts if ambiguous.
 */

import * as readline from 'readline';

const BASE_ID       = 'appiP6I9snDwhlQNv';
const TABLE_COFFEES = 'tblrUgReenKRwH6hQ';
const TABLE_LOGS    = 'tblUSQ7YrpQOd4q60';
const TABLE_WATER   = 'tblx1oIXzTmuUlj3c';

// Field IDs — Coffee Logs
const F = {
  date:        'fldTTrFcDrDe2a49J',
  beanLink:    'fldpA48fFAZHoqTlA',
  status:      'fldNYKAFx7Th2OTmW',
  method:      'fldVsmX6njUj9i1Gm',
  notes:       'fldGWcTq2r11i07sP',
  ratio:       'fld5jQ1y2xW4epdrS',
  waterVol:    'fld8SIV6g5S8Al9hA',
  waterTemp:   'fldR1sO5SDmy4JlUk',
  grindMK4:    'fldmqU6sYvohh0kt9',
  dripper:     'fldZtAi6LSQp0ECgb',
  paper:       'fldNlq2NYGTbRnp6C',
  pourGuide:   'fldEtEiCmV4kVOSLg',
  improvement: 'fldEx3VtbXilXDZj3',
  waterSource: 'fldqdHfLAsbPt1wF5',
} as const;

// Field IDs — Coffees
const F_BEAN = {
  name:    'fldSsg7zvlJCKTfY4',
  farm:    'fldqFWSvrwt1ilpMy',
  lot:     'fldwGEOKzakerKTUh',
  variety: 'fldRzY40HiDIYZgvZ',
} as const;

// Field IDs — Water Formulas
const F_WATER = {
  name: 'fld2p1fWEcYPmcT5s',
} as const;

// Flavor keyword → tag mapping
const FLAVOR_MAP: Record<string, string[]> = {
  orange: ['Orange','Fruity'], citrus: ['Zesty','Citrus'], lemon: ['Lemon','Zesty'],
  peach: ['Peach','Fruity'], berry: ['Berry','Fruity'], blueberry: ['Blueberry','Fruity'],
  cherry: ['Cherry','Fruity'], strawberry: ['Strawberry','Fruity'], mango: ['Mango','Fruity'],
  pineapple: ['Pineapple','Fruity'], jasmine: ['Jasmine','Floral'], floral: ['Floral'],
  rose: ['Rose','Floral'], lavender: ['Lavender','Floral'], chamomile: ['Chamomile','Floral'],
  tea: ['Tea-like'], chocolate: ['Chocolate'], cocoa: ['Cocoa'], caramel: ['Caramel'],
  sweet: ['Sweet'], honey: ['Honey','Sweet'], vanilla: ['Vanilla','Sweet'], nutty: ['Nutty'],
  clean: ['Clean'], balance: ['Balanced'], balanced: ['Balanced'], complex: ['Complex'],
  bright: ['Bright'], soft: ['Soft'], syrup: ['Syrupy'], silky: ['Soft','Balanced'],
  smooth: ['Soft'], rum: ['Rum'], whiskey: ['Whiskey'], winery: ['Winery'],
  aftertaste: ['Long Aftertaste'], long: ['Long Aftertaste'], delicate: ['Delicate'],
  juicy: ['Juicy'], lime: ['Lime','Zesty'], passionfruit: ['Passionfruit'], guava: ['Guava'],
  mulberry: ['Mulberry'], mint: ['Mint'], apricot: ['Dried Apricot'], sakura: ['Sakura'],
  lychee: ['Lychee'], plum: ['Berry','Fruity'], fruity: ['Fruity'], syrupy: ['Syrupy'],
  bold: ['Bold'], 'high sweet': ['High Sweet','Sweet'], blackcurrant: ['Berry','Fruity'],
  purple: ['Berry','Fruity'], butter: ['Butter'],
};

function extractTags(taste: string): string[] {
  const lower = taste.toLowerCase();
  const found = new Set<string>();
  for (const [kw, tags] of Object.entries(FLAVOR_MAP)) {
    if (lower.includes(kw)) tags.forEach(t => found.add(t));
  }
  return [...found];
}

function buildNotes(taste: string, waterSource?: string): string {
  const tags = extractTags(taste);
  let notes = taste.trim();
  if (tags.length > 0) notes += `\n\nFlavors: ${tags.join(', ')}`;
  if (waterSource)     notes += `\n\nWater: ${waterSource}`;
  return notes;
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      result[key] = val;
    }
  }
  return result;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function atGet(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- standalone CLI; Airtable response shape is consumed loosely downstream
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  return data;
}

async function atPost(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- standalone CLI; Airtable response shape is consumed loosely downstream
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  return data;
}

async function findOrCreateBean(
  name: string,
  token: string,
  farm?: string,
  lot?: string,
  variety?: string,
): Promise<string> {
  const encoded = encodeURIComponent(`SEARCH("${name.replace(/"/g, '\\"')}",{Name})`);
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_COFFEES}`
    + `?filterByFormula=${encoded}`
    + `&fields%5B%5D=${F_BEAN.name}&fields%5B%5D=${F_BEAN.farm}&pageSize=10`;
  const data = await atGet(url, token);

  if (data.records?.length === 1) {
    const rec = data.records[0];
    const label = rec.fields[F_BEAN.name] ?? rec.id;
    const farmLabel = rec.fields[F_BEAN.farm] ? ` (${rec.fields[F_BEAN.farm]})` : '';
    console.log(`  bean: ${label}${farmLabel} → ${rec.id}`);
    return rec.id as string;
  }

  if (data.records?.length > 1) {
    console.log(`\n  ${data.records.length} matches found:`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose Airtable record shape (vendored CLI)
    data.records.forEach((r: any, i: number) => {
      const n = r.fields[F_BEAN.name] ?? r.id;
      const f = r.fields[F_BEAN.farm] ? ` (${r.fields[F_BEAN.farm]})` : '';
      console.log(`  [${i + 1}] ${n}${f}`);
    });
    console.log(`  [0] Create new — "${name}"`);
    const choice = await ask('  Select [0–N]: ');
    const idx = parseInt(choice);
    if (!isNaN(idx) && idx > 0 && idx <= data.records.length) {
      console.log(`  → using: ${data.records[idx - 1].fields[F_BEAN.name]}`);
      return data.records[idx - 1].id as string;
    }
  }

  // Create new bean
  console.log(`  bean not found — creating "${name}"…`);
  const beanFields: Record<string, unknown> = { [F_BEAN.name]: name };
  if (farm)    beanFields[F_BEAN.farm]    = farm;
  if (lot)     beanFields[F_BEAN.lot]     = lot;
  if (variety) beanFields[F_BEAN.variety] = variety;

  const created = await atPost(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_COFFEES}`,
    token,
    { records: [{ fields: beanFields }] }
  );
  const id = created.records?.[0]?.id as string;
  console.log(`  created bean: ${id}`);
  return id;
}

async function findWaterFormula(name: string, token: string): Promise<string | null> {
  const encoded = encodeURIComponent(`SEARCH("${name.replace(/"/g, '\\"')}",{Name})`);
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_WATER}`
    + `?filterByFormula=${encoded}`
    + `&fields%5B%5D=${F_WATER.name}&pageSize=5`;
  const data = await atGet(url, token);
  if (data.records?.length > 0) {
    const label = data.records[0].fields[F_WATER.name] ?? data.records[0].id;
    console.log(`  water: ${label} → ${data.records[0].id}`);
    return data.records[0].id as string;
  }
  console.log(`  water formula "${name}" not found — omitting`);
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const required = ['bean','grind','temp','ratio','water','taste'] as const;
  const missing = required.filter(k => !args[k]);
  if (missing.length > 0) {
    console.error(`\nMissing required args: ${missing.map(m => `--${m}`).join(', ')}\n`);
    console.error('Run with --help for usage.');
    process.exit(1);
  }

  const token = process.env.AT_TOKEN ?? '';
  if (!token) {
    console.error('Set AT_TOKEN env var with your Airtable Personal Access Token.');
    process.exit(1);
  }

  const today = args.date ?? new Date().toISOString().split('T')[0];
  const notes  = buildNotes(args.taste, args['water-formula']);

  console.log('\n☕ log-coffee');
  console.log(`  ${args.bean} · ${args.grind}click · ${args.temp}°C · ${args.ratio} · ${args.water}g`);
  if (args.farm)    console.log(`  farm: ${args.farm}`);
  if (args.lot)     console.log(`  lot:  ${args.lot}`);
  if (args.variety) console.log(`  var:  ${args.variety}`);
  console.log(`  date: ${today}`);

  const beanId = await findOrCreateBean(
    args.bean, token,
    args.farm, args.lot, args.variety,
  );

  let waterFormulaId: string | null = null;
  if (args['water-formula']) {
    waterFormulaId = await findWaterFormula(args['water-formula'], token);
  }

  const fields: Record<string, unknown> = {
    [F.date]:      today,
    [F.beanLink]:  [{ id: beanId }],
    [F.status]:    args.status  ?? 'Done',
    [F.method]:    args.method  ?? 'Filter Drip',
    [F.grindMK4]:  Number(args.grind),
    [F.waterTemp]: Number(args.temp),
    [F.ratio]:     args.ratio,
    [F.waterVol]:  Number(args.water),
    [F.notes]:     notes,
  };

  if (args.dripper)      fields[F.dripper]     = args.dripper;
  if (args.paper)        fields[F.paper]       = args.paper;
  if (args.pour)         fields[F.pourGuide]   = args.pour.replace(/\\n/g, '\n');
  if (args.improve)      fields[F.improvement] = args.improve;
  if (waterFormulaId)    fields[F.waterSource] = [{ id: waterFormulaId }];

  const result = await atPost(
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_LOGS}?typecast=true`,
    token,
    { records: [{ fields }] }
  );

  const recId = result.records?.[0]?.id;
  console.log(`\n  ✓ logged → ${recId}`);
  console.log(`  notes preview: ${notes.slice(0, 80)}…\n`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
