/**
 * TASK-2026-09-12-EXPLORATION-REPAIR · Algol
 * Run: node --test tests/worldline-focus-reset-contract.test.mjs
 *
 * Retains the historical filename but retires rejected HomeFocus intro, CTA and
 * assignment requirements. Executes current source from in-memory TS copies;
 * only reader, visual-child and browser/hook boundaries are mocked. Publication
 * filtering remains independently covered by publication-consistency.test.mjs.
 * These checks do not establish rendered layout or real browser history.
 */
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInThisContext, runInNewContext } from 'node:vm'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import React from 'react'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const sourceHashes = new Map()
const digest = (source) => createHash('sha256').update(source).digest('hex')

function loadSource(relativePath, dependencies, globals = {}) {
  const filename = path.join(root, relativePath)
  const source = readFileSync(filename, 'utf8')
  if (!sourceHashes.has(filename)) sourceHashes.set(filename, digest(source))
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const compiledModule = { exports: {} }
  const runtimeRequire = (name) => {
    if (name === 'react/jsx-runtime') return require(name)
    assert.ok(Object.hasOwn(dependencies, name), 'undeclared dependency: ' + name)
    return dependencies[name]
  }
  const execute = runInThisContext(
    '(function(require,module,exports,' + Object.keys(globals).join(',') + '){\n' + compiled + '\n})',
    { filename },
  )
  execute(runtimeRequire, compiledModule, compiledModule.exports, ...Object.values(globals))
  return compiledModule.exports
}

function boundary(name) {
  return { [name]() { return null } }[name]
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!React.isValidElement(node)) return []
  return [node, ...elements(node.props.children)]
}

function only(tree, type) {
  const matches = elements(tree).filter((node) => node.type === type)
  assert.equal(matches.length, 1, 'expected one ' + (type.name ?? type))
  return matches[0]
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join('')
  if (React.isValidElement(node)) return textContent(node.props.children)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}

function homeFixture(articles = []) {
  const names = [
    'CornerMarks', 'Nav', 'HeroBlock', 'AttractorFilterShell', 'FooterManifesto',
    'PageShell', 'SurveyCursor', 'MarginaliaHUD', 'ScrollMeter',
  ]
  const components = Object.fromEntries(names.map((name) => [name, boundary(name)]))
  const dependencies = Object.fromEntries(names.map((name) => [
    '@/components/' + name, { [name]: components[name] },
  ]))
  dependencies['@/components/MarginaliaHUD'].ScrollMeter = components.ScrollMeter
  const calls = []
  const alphaPlace = { coord: { lat: 13.75, lon: 100.5 }, privateExtra: 'not a public prop' }
  const stats = { surveyed: 12, active: 7 }
  dependencies['@/lib/store/reads'] = {
    async getAlphaPlace() { calls.push(['alpha']); return alphaPlace },
  }
  dependencies['@/lib/content'] = {
    async getWorldlineStats(lang) { calls.push(['stats', lang]); return stats },
    async getRecentArticles(limit, lang) { calls.push(['articles', limit, lang]); return articles },
  }
  const { default: Home } = loadSource('app/[lang]/page.tsx', dependencies)
  return {
    components, calls, stats,
    render(lang, search = {}) {
      return Home({ params: Promise.resolve({ lang }), searchParams: Promise.resolve(search) })
    },
  }
}

test('restored server homepage composes the original observatory and accepted footer', async () => {
  const fixture = homeFixture()
  const tree = await fixture.render('th')
  const { components } = fixture
  assert.equal(tree.type, components.PageShell)
  const main = only(tree, 'main')
  assert.match(main.props.className, /\bpaper-canvas\b/)
  assert.equal(main.props['data-theme'], undefined, 'home must not force the rejected dark theme')
  assert.deepEqual(React.Children.toArray(main.props.children).map((child) => child.type), [
    components.CornerMarks, components.ScrollMeter, components.MarginaliaHUD,
    components.SurveyCursor, components.Nav, components.HeroBlock,
    components.AttractorFilterShell, components.FooterManifesto,
  ])
  assert.deepEqual(only(tree, components.HeroBlock).props, {
    alphaCoord: { lat: 13.75, lon: 100.5 }, stats: fixture.stats,
  })
  assert.deepEqual(only(tree, components.FooterManifesto).props, {})
  const source = ts.createSourceFile('page.tsx', readFileSync(path.join(root, 'app/[lang]/page.tsx'), 'utf8'), ts.ScriptTarget.Latest)
  assert.equal(source.statements.some((statement) =>
    ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)
      && statement.expression.text === 'use client'), false)
})

test('both home languages retain current public article reads and the minimal card projection', async () => {
  for (const lang of ['en', 'th']) {
    const card = {
      fileNum: 'published-101', title: lang + ' public work', date: '2026.09.12',
      tags: ['coffee'], status: 'published', readingTime: 3, lang,
    }
    const fixture = homeFixture([{ ...card, body: 'never sent to Traces', coords: { lat: 1, lon: 2 } }])
    const tree = await fixture.render(lang, { tag: 'coffee' })
    assert.deepEqual(fixture.calls, [['alpha'], ['stats', lang], ['articles', 4, lang]])
    assert.deepEqual(only(tree, fixture.components.AttractorFilterShell).props, {
      entries: [card], lang, initialTag: 'coffee',
    })
  }
})

test('an empty public article corpus reaches Traces unchanged in either language', async () => {
  for (const lang of ['en', 'th']) {
    const fixture = homeFixture([])
    const tree = await fixture.render(lang)
    assert.deepEqual(only(tree, fixture.components.AttractorFilterShell).props, {
      entries: [], lang, initialTag: 'all',
    })
  }
})

test('the compact HeroBlock owns one title and one live Atlas with server data', () => {
  const WorldlineGlobe = boundary('WorldlineGlobe')
  const DivergenceMeter = boundary('DivergenceMeter')
  const { HeroBlock } = loadSource('components/HeroBlock.tsx', {
    react: { useEffect() {}, useRef: () => ({ current: null }) },
    animejs: { animate() {} },
    './WorldlineGlobe': { WorldlineGlobe },
    './DivergenceMeter': { DivergenceMeter },
  })
  const props = { alphaCoord: { lat: 13.75, lon: 100.5 }, stats: { surveyed: 12, active: 7 } }
  const tree = HeroBlock(props)
  assert.equal(tree.type, 'section')
  assert.equal(tree.props.id, 'hero')
  assert.equal(textContent(only(tree, 'h1')), 'an archive of unfinished thought, surveyed openly.')
  assert.deepEqual(only(tree, WorldlineGlobe).props, props)
  assert.deepEqual(only(tree, DivergenceMeter).props, { size: 'sm', compact: true })
  assert.equal(elements(tree).filter((node) => ['a', 'button'].includes(node.type)).length, 0)
})

test('locale destinations normalize one supported prefix and preserve exact query and anchor context', () => {
  const { localeSwitchHref } = loadSource('components/LocaleSwitcher.tsx', { react: React })
  const cases = [
    ['/', '/th', '/'], ['/en', '/th', '/'], ['/en/', '/th', '/'],
    ['/th', '/th', '/'], ['/th/', '/th', '/'],
    ['/archive', '/th/archive', '/archive'],
    ['/en/archive', '/th/archive', '/archive'],
    ['/th/archive', '/th/archive', '/archive'],
    ['/en/articles/002', '/th/articles/002', '/articles/002'],
    ['/th/fiction/transmission-001', '/th/fiction/transmission-001', '/fiction/transmission-001'],
    ['/photos/roll/frame', '/th/photos/roll/frame', '/photos/roll/frame'],
    ['/enigma', '/th/enigma', '/enigma'],
    ['/theory', '/th/theory', '/theory'],
    ['/archive/en', '/th/archive/en', '/archive/en'],
  ]
  const query = '?tag=coffee&query=%E0%B9%84%E0%B8%97%E0%B8%A2'
  const hash = '#current-target'
  for (const [pathname, thai, english] of cases) {
    assert.equal(localeSwitchHref(pathname, 'th'), thai, pathname + ' → TH')
    assert.equal(localeSwitchHref(pathname, 'en'), english, pathname + ' → EN')
    assert.equal(localeSwitchHref(pathname, 'th', query, hash), thai + query + hash)
    assert.equal(localeSwitchHref(thai, 'en', query, hash), english + query + hash)
    assert.equal(localeSwitchHref(english, 'th', query, hash), thai + query + hash)
  }
})

/** Run the actual component and onClick closures without changing globals. */
function switchFixture(pathname, reducedMotion) {
  const states = []
  const effects = []
  const timers = new Map()
  let stateIndex = 0
  let mounted = false
  let nextTimer = 0
  const location = { pathname, search: '?tag=coffee', hash: '#atlas', href: 'unchanged' }
  const document = { cookie: '' }
  const { LocaleSwitcher } = loadSource('components/LocaleSwitcher.tsx', {
    react: {
      useState(initial) {
        const index = stateIndex++
        if (!Object.hasOwn(states, index)) states[index] = initial
        return [states[index], (value) => { states[index] = value }]
      },
      useEffect(effect) { if (!mounted) effects.push(effect) },
    },
  }, {
    window: { location, matchMedia: () => ({ matches: reducedMotion }) },
    document,
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  })
  function render() { stateIndex = 0; return LocaleSwitcher() }
  function flush(delay) {
    for (const [id, timer] of [...timers]) {
      if (timer.delay === delay) { timers.delete(id); timer.callback() }
    }
  }
  assert.equal(render(), null, 'server/initial render stays hydration-safe')
  mounted = true
  for (const effect of effects) effect()
  flush(0)
  return {
    location, document, timers, flush, render,
    click(label) {
      const control = elements(render()).find((node) => node.props.label === label)
      assert.ok(control, 'missing locale control ' + label)
      control.props.onClick()
    },
  }
}

test('actual locale handlers preserve context through reduced-motion and delayed navigation', () => {
  const cases = [
    ['/en', 'TH', '/th?tag=coffee#atlas'],
    ['/en/articles/002', 'TH', '/th/articles/002?tag=coffee#atlas'],
    ['/th', 'EN', '/?tag=coffee#atlas'],
    ['/th/archive', 'EN', '/archive?tag=coffee#atlas'],
  ]
  for (const reducedMotion of [true, false]) {
    for (const [pathname, target, expected] of cases) {
      const fixture = switchFixture(pathname, reducedMotion)
      assert.equal(fixture.render().props.style.opacity, 1)
      fixture.click(target)
      assert.equal(fixture.document.cookie, 'wl_locale=' + target.toLowerCase() + '; Path=/; Max-Age=31536000; SameSite=Lax')
      if (!reducedMotion) {
        assert.equal(fixture.location.href, 'unchanged', 'normal motion waits for the label fade')
        assert.equal(fixture.render().props.style.opacity, 0)
        assert.deepEqual([...fixture.timers.values()].map((timer) => timer.delay), [120])
        fixture.flush(120)
      }
      assert.equal(fixture.location.href, expected)
      assert.equal(fixture.timers.size, 0)
    }
  }
})

test('selecting the active language does not write a cookie or navigate', () => {
  for (const [pathname, active] of [['/en', 'EN'], ['/th', 'TH']]) {
    const fixture = switchFixture(pathname, false)
    fixture.click(active)
    assert.equal(fixture.document.cookie, '')
    assert.equal(fixture.location.href, 'unchanged')
    assert.equal(fixture.timers.size, 0)
  }
})

/** Only hook, timer and animation boundaries are controlled; browser probes own layout and hydration. */
function bootHookBoundary(load, options = {}) {
  const slots = []
  const pendingEffects = []
  const stateUpdates = []
  const timers = new Map()
  const microtasks = []
  const animations = []
  const roots = []
  let index = 0
  let now = 0
  let timerId = 0
  let dirty = true
  let tree
  let props = options.props ?? {}
  const dependenciesChanged = (before, after) => !before || !after || before.length !== after.length || after.some((value, i) => !Object.is(value, before[i]))
  const hooks = {
    useState(initial) {
      const current = index++
      if (!slots[current]) slots[current] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[current].value, update => {
        stateUpdates.push(() => { slots[current].value = typeof update === 'function' ? update(slots[current].value) : update })
        dirty = true
      }]
    },
    useRef(initial) {
      const current = index++
      if (!slots[current]) slots[current] = { value: { current: initial } }
      return slots[current].value
    },
    useEffect(effect, dependencies) {
      const current = index++
      const previous = slots[current]
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        pendingEffects.push(() => {
          previous?.cleanup?.()
          const cleanup = effect()
          slots[current].cleanup = cleanup
        })
        slots[current] = { dependencies, cleanup: previous?.cleanup }
      }
    },
    useMemo(factory, dependencies) {
      const current = index++
      if (!slots[current] || dependenciesChanged(slots[current].dependencies, dependencies)) slots[current] = { dependencies, value: factory() }
      return slots[current].value
    },
    useCallback(callback, dependencies) { return hooks.useMemo(() => callback, dependencies) },
    useSyncExternalStore(_subscribe, snapshot, serverSnapshot) { return options.hydration ? serverSnapshot() : snapshot() },
  }
  const time = {
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    queueMicrotask(callback) { microtasks.push(callback) },
  }
  const anime = {
    animate(target, settings) {
      const record = { target, settings, cancelled: false, paused: false }
      animations.push(record)
      return { pause() { record.paused = true }, cancel() { record.cancelled = true }, revert() { record.reverted = true } }
    },
  }
  const component = load({ hooks, time, anime })
  function render() {
    while (stateUpdates.length) stateUpdates.shift()()
    index = 0; dirty = false; tree = component(props)
    const lineNodes = elements(tree).filter(node => String(node.props.className).split(' ').includes('boot-line')).map(node => ({ textContent: textContent(node), style: { ...node.props.style }, className: node.props.className }))
    for (const node of elements(tree)) {
      if (node.props.ref && typeof node.props.ref === 'object') {
        if (!node.props.ref.current) { node.props.ref.current = { style: {}, dataset: {} }; roots.push(node.props.ref.current) }
        Object.assign(node.props.ref.current.style, node.props.style)
        node.props.ref.current.querySelectorAll = selector => selector === '.boot-line' ? lineNodes : []
      }
    }
    return tree
  }
  function settle() {
    let turns = 0
    while (dirty || pendingEffects.length || microtasks.length) {
      if (++turns > 30) throw Error('Component failed to settle')
      if (dirty) render()
      while (pendingEffects.length) pendingEffects.shift()()
      while (microtasks.length) microtasks.shift()()
    }
    return tree
  }
  function advance(ms) {
    const end = now + ms
    let turns = 0
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      if (++turns > 100) throw Error('Timer loop did not terminate')
      now = next[1].at; timers.delete(next[0]); next[1].callback(); settle()
    }
    now = end; return settle()
  }
  return {
    render, settle, advance, animations, timers, roots,
    tree: () => tree,
    update(next) { props = { ...props, ...next }; dirty = true; return settle() },
    unmount() { for (const slot of slots) slot?.cleanup?.() },
  }
}


const expectedBootLines = [
  'INITIALIZING WORLDLINE …',
  'ATTACHING TRACE :: ATLAS / NETRA',
  'RESOLVING ATTRACTOR FIELD …',
  'PATCHING DIVERGENCE :: 1.130426',
  'BREAKPOINT SET @ α-LOCUS',
  'OBSERVATORY :: ONLINE',
  'WORLDLINE PATCHED · OBSERVING.',
]

function printedBootLines(tree) {
  return elements(tree).filter(node => String(node.props.className).split(' ').includes('boot-line'))
    .map(node => textContent(node).slice(1))
}

function bootFixture({ active = true, reducedMotion = false } = {}) {
  let completions = 0
  const fixture = bootHookBoundary(({ hooks, time, anime }) => loadSource('components/BootSequence.tsx', {
    react: hooks, animejs: anime,
  }, {
    ...time,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    window: { matchMedia: () => ({ matches: reducedMotion }) },
  }).BootSequence, { props: { active, onDoneAction: () => { completions += 1 } } })
  return Object.assign(fixture, { completions: () => completions })
}

function shellFixture({ seen = null, throws = false, hydration = false } = {}) {
  const writes = []
  const BootSequence = boundary('BootSequence')
  const fixture = bootHookBoundary(({ hooks }) => {
    const { PageShell } = loadSource('components/PageShell.tsx', {
      react: hooks, './BootSequence': { BootSequence, BOOT_STORAGE_KEY: 'wl:boot-seen' },
    }, {
      sessionStorage: {
        getItem() { if (throws) throw Error('storage unavailable'); return seen },
        setItem(key, value) { writes.push([key, value]); if (throws) throw Error('storage unavailable') },
      },
    })
    return elements(PageShell({ children: 'BASE PAGE CONTENT' })).find(node => typeof node.type === 'function').type
  }, { hydration })
  return Object.assign(fixture, { BootSequence, writes })
}

test('real SSR places an inactive boot cover before the preserved base page', () => {
  const { BootSequence } = loadSource('components/BootSequence.tsx', { react: React, animejs: { animate() { throw Error('SSR must not animate') } } })
  const { PageShell } = loadSource('components/PageShell.tsx', {
    react: React, './BootSequence': { BootSequence, BOOT_STORAGE_KEY: 'wl:boot-seen' },
  })
  const html = renderToStaticMarkup(React.createElement(PageShell, null, React.createElement('main', null, 'BASE PAGE CONTENT')))
  assert.ok(html.indexOf('data-worldline-boot') < html.indexOf('<main>'))
  assert.ok(html.includes('data-boot-phase="pending"'))
  assert.ok(html.includes('<main>BASE PAGE CONTENT</main>'), 'base children are present for history restoration')
  assert.ok(html.includes('<noscript>'), 'HTML-only visitors receive the no-script fallback')
  const hydration = shellFixture({ hydration: true })
  const firstClientBoundary = hydration.render()
  assert.equal(firstClientBoundary.type, hydration.BootSequence)
  assert.equal(firstClientBoundary.props.active, false, 'hydration snapshot keeps the same pending cover')
})

test('the executed parser bootstrap hides only a seen session cover and tolerates unavailable storage', () => {
  const fixture = bootFixture({ active: false })
  const script = only(fixture.render(), 'script').props.dangerouslySetInnerHTML.__html
  for (const [seen, throws, display] of [[null, false, undefined], ['1', false, 'none'], [null, true, undefined]]) {
    const cover = { style: {} }
    const otherContent = { style: {} }
    runInNewContext(script, {
      document: { currentScript: { parentElement: cover }, body: otherContent },
      sessionStorage: { getItem(key) { assert.equal(key, 'wl:boot-seen'); if (throws) throw Error('blocked'); return seen } },
    })
    assert.equal(cover.style.display, display)
    assert.deepEqual(otherContent.style, {})
  }
})

test('pending boot does not animate or complete until client activation', () => {
  const fixture = bootFixture({ active: false })
  fixture.settle()
  fixture.advance(5000)
  assert.equal(fixture.tree().props['data-boot-phase'], 'pending')
  assert.equal(fixture.animations.length, 0)
  assert.equal(fixture.timers.size, 0)
  assert.equal(fixture.completions(), 0)
  fixture.update({ active: true })
  assert.equal(fixture.tree().props['data-boot-phase'], 'loading')
  fixture.advance(220)
  assert.deepEqual(printedBootLines(fixture.tree()), expectedBootLines.slice(0, 1))
  fixture.unmount()
  assert.equal(fixture.timers.size, 0)
})

test('normal boot prints seven ordered lines before dismissal and completes exactly once', () => {
  const fixture = bootFixture()
  fixture.settle()
  for (let count = 1; count <= 7; count += 1) {
    fixture.advance(220)
    assert.deepEqual(printedBootLines(fixture.tree()), expectedBootLines.slice(0, count))
    assert.equal(fixture.tree().props['data-boot-phase'], 'loading')
    assert.equal(fixture.completions(), 0)
  }
  fixture.advance(220)
  assert.equal(fixture.tree().props['data-boot-phase'], 'exiting')
  const fade = fixture.animations.find(animation => animation.settings.onComplete)
  assert.ok(fade)
  assert.equal(fade.settings.duration, 700)
  fade.settings.onComplete()
  fade.settings.onComplete()
  assert.equal(fixture.completions(), 1)
  fixture.unmount()
  assert.equal(fade.paused, true)
})

test('reduced motion renders the complete terminal transcript without animation and exits after 200ms', () => {
  const fixture = bootFixture({ reducedMotion: true })
  fixture.settle()
  assert.deepEqual(printedBootLines(fixture.tree()), expectedBootLines)
  assert.equal(fixture.animations.length, 0, 'caret and line entry are reduced-motion safe too')
  fixture.advance(199)
  assert.equal(fixture.completions(), 0)
  fixture.advance(1)
  assert.equal(fixture.completions(), 1)
  fixture.advance(1000)
  assert.equal(fixture.completions(), 1)
  fixture.unmount()
})

test('unmount cancels pending, reduced-motion, and active-fade completion callbacks', () => {
  for (const reducedMotion of [false, true]) {
    const fixture = bootFixture({ reducedMotion })
    fixture.settle()
    const pending = [...fixture.timers.values()].map(timer => timer.callback)
    fixture.unmount()
    assert.equal(fixture.timers.size, 0)
    assert.ok(fixture.animations.every(animation => animation.paused || animation.reverted))
    for (const callback of pending) callback()
    fixture.advance(5000)
    assert.equal(fixture.completions(), 0)
  }
  const fixture = bootFixture()
  fixture.settle()
  fixture.advance(1760)
  const fade = fixture.animations.find(animation => animation.settings.onComplete)
  fixture.unmount()
  fade.settings.onComplete()
  assert.ok(fixture.animations.every(animation => animation.paused || animation.reverted))
  assert.equal(fixture.completions(), 0)
  assert.equal(fade.paused, true)
})

test('seen client mounts skip boot immediately and storage failures still allow completion', () => {
  const returning = shellFixture({ seen: '1' })
  assert.equal(returning.render(), null)
  for (const throws of [false, true]) {
    const fixture = shellFixture({ throws })
    const cover = fixture.settle()
    assert.equal(cover.type, fixture.BootSequence)
    assert.equal(cover.props.active, true)
    cover.props.onDoneAction()
    assert.equal(fixture.settle(), null, 'completed page cannot be stranded by storage writes')
    assert.deepEqual(fixture.writes, [['wl:boot-seen', '1']])
  }
})



// STABLE-NETRA: execute the presentation helper and the real readout render.
// Geometry, pointer selection and lifecycle transitions are verified in browser probes.
function netraPresentationFixture() {
  const coordinates = loadSource('lib/globe-coordinates.ts', {})
  const presentation = loadSource('components/worldline-netra-readout.ts', {
    '@/lib/globe-coordinates': coordinates,
  })
  return { coordinates, presentation }
}

test('place identity preserves a genuine internal name and removes duplicated city labels', () => {
  const { presentation: { createNetraPlaceIdentity, formatNetraTargetIdentity } } = netraPresentationFixture()
  const cases = [
    ['Bangkok · TH', 'α', { nodeName: 'α', name: 'BANGKOK', primary: 'α · BANGKOK ·', secondary: 'TH', full: 'α · BANGKOK · TH' }],
    ['Chiang Mai · th', 'CHIANG   MAI', { nodeName: '', name: 'CHIANG MAI', primary: 'CHIANG MAI ·', secondary: 'TH', full: 'CHIANG MAI · TH' }],
    ['Tokyo · JP', undefined, { nodeName: '', name: 'TOKYO', primary: 'TOKYO ·', secondary: 'JP', full: 'TOKYO · JP' }],
    ['Yirgacheffe · ET', 'YIRGACHEFFE', { nodeName: '', name: 'YIRGACHEFFE', primary: 'YIRGACHEFFE ·', secondary: 'ET', full: 'YIRGACHEFFE · ET' }],
  ]
  for (const [place, internal, expected] of cases) {
    assert.deepEqual(formatNetraTargetIdentity(createNetraPlaceIdentity(place, internal)), expected)
  }
})

test('missing country and future long names retain truthful complete semantic text', () => {
  const { presentation: { createNetraPlaceIdentity, formatNetraTargetIdentity } } = netraPresentationFixture()
  assert.deepEqual(formatNetraTargetIdentity(createNetraPlaceIdentity('  Kyoto  ')), {
    nodeName: '', name: 'KYOTO', primary: 'KYOTO', secondary: '', full: 'KYOTO',
  })
  const internal = 'Field notebook from the eastern river observatory'
  const city = 'A future city with a deliberately long authored name'
  const identity = formatNetraTargetIdentity(createNetraPlaceIdentity(city + ' · NZ', internal))
  assert.equal(identity.nodeName, internal)
  assert.equal(identity.name, city.toUpperCase())
  assert.equal(identity.secondary, 'NZ')
  assert.equal(identity.full, internal + ' · ' + city.toUpperCase() + ' · NZ')
  assert.ok(!identity.full.includes('…'), 'visual truncation must not destroy accessible source text')
})

test('nongeographic identities and empty coordinates never acquire invented place data', () => {
  const { presentation: { formatNetraTargetIdentity, formatNetraCoordinateRows } } = netraPresentationFixture()
  assert.deepEqual(formatNetraTargetIdentity({ kind: 'orbital', name: 't.001', detail: 'NeX · identity' }), {
    nodeName: '', name: 't.001', primary: 't.001 ·', secondary: 'NeX · identity', full: 't.001 · NeX · identity',
  })
  assert.deepEqual(formatNetraTargetIdentity({ kind: 'field', name: 'STANDBY' }), {
    nodeName: '', name: 'STANDBY', primary: 'STANDBY', secondary: '', full: 'STANDBY',
  })
  assert.deepEqual(formatNetraCoordinateRows(null), { latitude: '', longitude: '' })
  assert.deepEqual(formatNetraCoordinateRows(null, true), { latitude: '—', longitude: '' })
})

test('coordinate rows preserve existing precision and hemispheres with the dot attached to latitude', () => {
  const { presentation: { formatNetraCoordinateRows } } = netraPresentationFixture()
  const cases = [
    [{ lat: 18.7883, lon: 98.9853 }, { latitude: '18.79°N ·', longitude: '98.99°E' }],
    [{ lat: 13.7563, lon: 100.5018 }, { latitude: '13.76°N ·', longitude: '100.50°E' }],
    [{ lat: -33.8688, lon: -151.2093 }, { latitude: '33.87°S ·', longitude: '151.21°W' }],
    [{ lat: 90, lon: 180 }, { latitude: '90.00°N ·', longitude: '180.00°E' }],
    [{ lat: -90, lon: -180 }, { latitude: '90.00°S ·', longitude: '180.00°W' }],
    [{ lat: 0, lon: 0 }, { latitude: '0.00°N ·', longitude: '0.00°E' }],
  ]
  for (const [coords, expected] of cases) {
    assert.deepEqual(formatNetraCoordinateRows(coords), expected)
    assert.deepEqual(formatNetraCoordinateRows(coords, true), expected, 'a real surface lock retains its priority')
  }
})

test('WorldlineGlobe renders the structured identity and preserves empty coordinate slots', () => {
  const { coordinates, presentation } = netraPresentationFixture()
  const palette = loadSource('lib/globe-palettes.ts', {})
  const identities = [
    presentation.createNetraPlaceIdentity('Bangkok · TH', 'α'),
    presentation.createNetraPlaceIdentity('Kyoto'),
    { kind: 'orbital', name: 't.001', detail: 'NeX · identity' },
  ]
  for (const identity of identities) {
    const noNetwork = () => { throw new Error('render must not fetch data or create globe textures') }
    const { WorldlineGlobe } = loadSource('components/WorldlineGlobe.tsx', {
      react: {
        useState(initial) {
          const value = typeof initial === 'function' ? initial() : initial
          return [value?.kind === 'field' && value.name === 'STANDBY' ? identity : value, () => {}]
        },
        useRef: (value) => ({ current: value }), useEffect() {},
        useMemo: (factory) => factory(), useCallback: (callback) => callback,
      },
      three: require('three'),
      '@/lib/useThemeMode': { useThemeMode: () => 'light' },
      '@/lib/globe-palettes': palette,
      '@/lib/content/places': { getPlacesSummary: noNetwork, getPlaceContent: noNetwork },
      '@/lib/globe-coordinates': coordinates,
      '@/lib/worldline-stats': loadSource('lib/worldline-stats.ts', {}),
      './worldline-netra-readout': presentation,
      '@/lib/client-state/globe-store': { WL_STRATUM_EVENT: 'stratum', WL_GLOBE_COORD_EVENT: 'coord' },
      '@/lib/content': { getFiction: noNetwork, getFictionSiblings: noNetwork },
      '@/lib/globe-surface': { buildSurfaceTextures: noNetwork },
    })
    const tree = WorldlineGlobe({ stats: { surveyed: 0, active: 0 } })
    const byClass = (name) => {
      const found = elements(tree).filter(node => String(node.props.className).split(' ').includes(name))
      assert.equal(found.length, 1, 'one semantic element: ' + name)
      return found[0]
    }
    const expected = presentation.formatNetraTargetIdentity(identity)
    assert.equal(textContent(byClass('netra-identity-primary')), expected.primary)
    assert.equal(textContent(byClass('netra-identity-secondary')), expected.secondary)
    assert.equal(byClass('tgt').props.title, expected.full)
    assert.equal(textContent(byClass('netra-place-name')), expected.name)
    assert.equal(textContent(byClass('netra-latitude')), '')
    assert.equal(textContent(byClass('netra-longitude')), '')
  }
})

test('explicit orbital identity rejects stale geographic locks while surface priority stays intact', () => {
  const { presentation: { resolveNetraCoordinateRows, createNetraPlaceIdentity } } = netraPresentationFixture()
  const lock = { lat: 13.7563, lon: 100.5018 }
  const hover = { lat: -33.8688, lon: -151.2093 }
  const orbital = { kind: 'orbital', name: 't.001', detail: 'NeX · identity' }
  for (const staleLock of [null, lock]) for (const staleHover of [null, hover]) for (const orbitalActive of [false, true]) {
    assert.deepEqual(resolveNetraCoordinateRows(orbital, staleLock, staleHover, orbitalActive), { latitude: '—', longitude: '' })
  }
  const place = createNetraPlaceIdentity('Bangkok · TH', 'α')
  assert.deepEqual(resolveNetraCoordinateRows(place, lock, hover, true), { latitude: '13.76°N ·', longitude: '100.50°E' })
  const field = { kind: 'field', name: 'STANDBY' }
  assert.deepEqual(resolveNetraCoordinateRows(field, null, hover, true), { latitude: '—', longitude: '' })
  assert.deepEqual(resolveNetraCoordinateRows(field, null, hover, false), { latitude: '33.87°S ·', longitude: '151.21°W' })
  assert.deepEqual(resolveNetraCoordinateRows(field, null, null, false), { latitude: '', longitude: '' })
})

after(() => {
  for (const [filename, originalHash] of sourceHashes) {
    assert.equal(digest(readFileSync(filename)), originalHash, 'test modified source: ' + filename)
  }
})
