import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'

type RouteEntry = { kind: string; path: string }
type RouteManifest = { schema_version: number; routes: RouteEntry[] }
type AxeNode = { target: unknown[]; failureSummary?: string }
type AxeViolation = { id: string; impact: string | null; help: string; nodes: AxeNode[] }
type Finding = {
  route: string
  id: string
  impact: string | null
  help: string
  targets: string[]
}

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

function argument(name: string): string | null {
  const index = process.argv.indexOf(name)
  if (index === -1) return null
  const value = process.argv[index + 1]
  if (!value) throw new Error(`${name} requires a value`)
  return value
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('could not allocate an accessibility server port'))
        return
      }
      const port = address.port
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next production server exited with code ${child.exitCode}`)
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000), redirect: 'manual' })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error('Next production server did not become ready within 30 seconds')
}

async function scanPage(page: Page, route: string): Promise<Finding[]> {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' })
  await page.addScriptTag({ content: axeSource })
  const result = await page.evaluate(async (tags) => {
    const engine = (globalThis as typeof globalThis & {
      axe: { run: (context: Document, options: unknown) => Promise<{ violations: AxeViolation[] }> }
    }).axe
    return await engine.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] })
  }, wcagTags)

  return result.violations.map((violation) => ({
    route,
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.flatMap((node) => node.target.map((target) => String(target))).sort(),
  }))
}

async function fixtureAudit(path: string): Promise<Finding[]> {
  if (!existsSync(path)) throw new Error(`fixture is unavailable: ${path}`)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    await page.setContent(readFileSync(path, 'utf8'), { waitUntil: 'load' })
    return await scanPage(page, 'fixture')
  } finally {
    await browser.close()
  }
}

function loadManifest(root: string): RouteManifest {
  const path = join(root, '.harness/a11y-routes.json')
  if (!existsSync(path)) throw new Error('accessibility route denominator is unavailable')
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as RouteManifest
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.routes) || manifest.routes.length === 0) {
    throw new Error('accessibility route denominator is malformed or empty')
  }
  const paths = manifest.routes.map((route) => route.path)
  if (
    new Set(paths).size !== paths.length
    || manifest.routes.some((route) => !route.kind || !route.path.startsWith('/') || route.path.startsWith('/console') || route.path.startsWith('/api'))
  ) throw new Error('accessibility route denominator must contain unique public paths')
  return manifest
}

async function productionAudit(root: string, configuredBaseUrl: string | null): Promise<Finding[]> {
  const manifest = loadManifest(root)
  let server: ChildProcess | null = null
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  let serverLogs = ''
  let baseUrl = configuredBaseUrl

  try {
    if (!baseUrl) {
      if (!existsSync(join(root, '.next/BUILD_ID'))) throw new Error('production build is unavailable; run npm run build before the accessibility rail')
      const port = await freePort()
      baseUrl = `http://127.0.0.1:${port}`
      server = spawn(join(root, 'node_modules/.bin/next'), ['start', '--hostname', '127.0.0.1', '--port', String(port)], {
        cwd: root,
        env: { ...process.env, NODE_ENV: 'production' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      server.stdout?.on('data', (chunk: Buffer) => { serverLogs = `${serverLogs}${chunk.toString()}`.slice(-20_000) })
      server.stderr?.on('data', (chunk: Buffer) => { serverLogs = `${serverLogs}${chunk.toString()}`.slice(-20_000) })
      try {
        await waitForServer(`${baseUrl}${manifest.routes[0].path}`, server)
      } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : 'server startup failed'}${serverLogs ? `: ${serverLogs.trim()}` : ''}`)
      }
    }

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
    const findings: Finding[] = []
    for (const route of manifest.routes) {
      const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'load', timeout: 30_000 })
      const status = response?.status() ?? 0
      if (status < 200 || status >= 400) {
        findings.push({ route: route.path, id: 'route-http-status', impact: 'critical', help: `expected a public 2xx/3xx route, received ${status}`, targets: [] })
        continue
      }
      findings.push(...await scanPage(page, route.path))
    }
    return findings
  } finally {
    await browser?.close()
    if (server && server.exitCode === null) {
      server.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 2_000)
        server?.once('exit', () => { clearTimeout(timeout); resolve() })
      })
    }
  }
}

async function main(): Promise<void> {
  const fixture = argument('--fixture')
  const root = argument('--root') ?? process.cwd()
  const baseUrl = argument('--base-url')
  const violations = fixture ? await fixtureAudit(fixture) : await productionAudit(root, baseUrl)
  violations.sort((a, b) => a.route.localeCompare(b.route) || a.id.localeCompare(b.id) || a.targets.join().localeCompare(b.targets.join()))
  process.stdout.write(`${JSON.stringify({
    pass: violations.length === 0,
    engine: 'axe-core',
    standard: 'WCAG 2.0/2.1/2.2 A/AA',
    routes_checked: fixture ? 1 : loadManifest(root).routes.length,
    violations,
  })}\n`)
  if (violations.length) process.exitCode = 1
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({
    pass: false,
    engine: 'axe-core',
    error: error instanceof Error ? error.message : 'unknown accessibility audit error',
    violations: [],
  })}\n`)
  process.exitCode = 2
})
