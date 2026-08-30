import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import ts from 'typescript'

type Violation = {
  id: string
  file: string
  line: number
  message: string
}
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'])
const ignoredDirectories = new Set([
  '.git', '.next', '.vercel', 'node_modules', 'public', 'tests', 'scripts',
  'docs', '.claude', '.agents', '.codex', '.cursor', '.gemini', '.specify',
])
const nextSecurityFloor = '16.3.3'

const documentationEvidence = [
  ['async-request-apis', /synchronous access is fully removed/i],
  ['partial-prerendering', /removes the experimental[\s\S]{0,100}Partial Prerendering/i],
  ['middleware-to-proxy', /middleware[^\n]{0,40}filename is deprecated[\s\S]{0,100}renamed to[^\n]{0,30}proxy/i],
  ['legacy-image', /next\/legacy\/image[\s\S]{0,100}deprecated/i],
  ['next-lint-removal', /next lint[\s\S]{0,120}(removed|no longer)/i],
  ['runtime-config-removal', /Runtime Configuration[\s\S]{0,500}removed/i],
  ['dynamic-io-removal', /experimental\.dynamicIO[\s\S]{0,160}(renamed|removed)/i],
  ['root-params-removal', /unstable_rootParams[\s\S]{0,160}removed/i],
] as const

function parseRoot(argv: string[]): string {
  const index = argv.indexOf('--root')
  if (index === -1) return process.cwd()
  const value = argv[index + 1]
  if (!value) throw new Error('--root requires a directory')
  return value
}

function extension(path: string): string {
  const match = path.match(/\.(?:mjs|cjs|mts|cts|jsx|tsx|js|ts)$/)
  return match?.[0] ?? ''
}

function isVersionAtLeast(actual: string, minimum: string): boolean {
  const parse = (value: string): [number, number, number] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(value)
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
  }
  const actualParts = parse(actual)
  const minimumParts = parse(minimum)
  if (!actualParts || !minimumParts) return false
  for (let index = 0; index < minimumParts.length; index += 1) {
    if (actualParts[index] !== minimumParts[index]) {
      return actualParts[index] > minimumParts[index]
    }
  }
  return true
}

function collectSourceFiles(root: string): string[] {
  const files: string[] = []
  const visit = (directory: string) => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(join(directory, entry.name))
        continue
      }
      const path = join(directory, entry.name)
      if (sourceExtensions.has(extension(path))) files.push(path)
    }
  }

  for (const directory of ['app', 'components', 'lib']) visit(join(root, directory))
  for (const name of ['proxy.ts', 'proxy.js', 'next.config.ts', 'next.config.js', 'next.config.mjs', 'next.config.cjs']) {
    const path = join(root, name)
    if (existsSync(path)) files.push(path)
  }
  return [...new Set(files)].sort()
}

function propertyName(node: ts.PropertyName | undefined): string | null {
  if (!node) return null
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text
  return null
}

function isImmediatelyAwaited(node: ts.Node): boolean {
  let current = node
  while (
    ts.isParenthesizedExpression(current.parent)
    || ts.isAsExpression(current.parent)
    || ts.isTypeAssertionExpression(current.parent)
    || ts.isNonNullExpression(current.parent)
  ) current = current.parent
  return ts.isAwaitExpression(current.parent)
}

function auditSource(root: string, path: string, violations: Violation[]): void {
  const source = readFileSync(path, 'utf8')
  const relativePath = relative(root, path).replaceAll('\\', '/')
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind)
  const requestApis = new Set<string>()

  const report = (id: string, node: ts.Node, message: string) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
    violations.push({ id, file: relativePath, line, message })
  }

  const routeEntry = /^app\/(?:.+\/)?(?:page|layout|route|default|opengraph-image|twitter-image|sitemap)\.(?:j|t)sx?$/.test(relativePath)
  const nextConfig = basename(path).startsWith('next.config.')

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text
      if (moduleName === 'next/router') {
        report('NEXT16_APP_ROUTER_IMPORT', node, "App Router code must import navigation APIs from 'next/navigation'")
      }
      if (moduleName === 'next/legacy/image') {
        report('NEXT16_LEGACY_IMAGE', node, "'next/legacy/image' is deprecated in Next 16")
      }
      if (moduleName === 'next/headers') {
        for (const element of node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
          ? node.importClause.namedBindings.elements
          : []) {
          const imported = element.propertyName?.text ?? element.name.text
          if (['cookies', 'headers', 'draftMode'].includes(imported)) requestApis.add(element.name.text)
        }
      }
      if (moduleName === 'next/cache' && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          const imported = element.propertyName?.text ?? element.name.text
          if (imported === 'unstable_cacheLife' || imported === 'unstable_cacheTag') {
            report('NEXT16_STABILIZED_CACHE_API', element, `${imported} was stabilized without the unstable_ prefix`)
          }
        }
      }
    }

    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && requestApis.has(node.expression.text)
      && !isImmediatelyAwaited(node)
    ) {
      report('NEXT16_ASYNC_REQUEST_API', node, `${node.expression.text}() must be awaited in Next 16`)
    }

    if (ts.isIdentifier(node) && node.text === 'unstable_rootParams') {
      report('NEXT16_REMOVED_ROOT_PARAMS', node, 'unstable_rootParams was removed in Next 16')
    }

    if (
      routeEntry
      && ts.isPropertySignature(node)
      && ['params', 'searchParams'].includes(propertyName(node.name) ?? '')
      && node.type
      && !(ts.isTypeReferenceNode(node.type) && ts.isIdentifier(node.type.typeName) && node.type.typeName.text === 'Promise')
    ) {
      report('NEXT16_ASYNC_ROUTE_PROPS', node, `${propertyName(node.name)} must be typed as a Promise in Next 16 route entries`)
    }

    if (nextConfig && ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name)
      if (['experimental_ppr', 'ppr', 'dynamicIO', 'publicRuntimeConfig', 'serverRuntimeConfig', 'skipMiddlewareUrlNormalize'].includes(name ?? '')) {
        report('NEXT16_REMOVED_CONFIG', node, `Next 16 removed or renamed next.config property '${name}'`)
      }
      if (name === 'domains') {
        report('NEXT16_DEPRECATED_IMAGE_DOMAINS', node, "images.domains is deprecated; use images.remotePatterns")
      }
    }

    if (
      (ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node))
      && propertyName(node.name) === 'getInitialProps'
    ) {
      report('NEXT16_PAGES_ROUTER_LIFECYCLE', node, 'getInitialProps is not allowed in this App Router-only codebase')
    }

    ts.forEachChild(node, visit)
  }
  visit(file)
}

function main(): void {
  const root = parseRoot(process.argv.slice(2))
  const nextPackagePath = join(root, 'node_modules/next/package.json')
  const guidePath = join(root, 'node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md')
  if (!existsSync(nextPackagePath) || !existsSync(guidePath)) {
    throw new Error('Next package or local Next 16 documentation is unavailable')
  }

  const nextPackage = JSON.parse(readFileSync(nextPackagePath, 'utf8')) as { version?: unknown }
  const nextVersion = typeof nextPackage.version === 'string' ? nextPackage.version : ''
  if (!/^16\./.test(nextVersion)) throw new Error(`sensor targets Next 16, found '${nextVersion || 'unknown'}'`)
  if (!isVersionAtLeast(nextVersion, nextSecurityFloor)) {
    throw new Error(`Next security floor is ${nextSecurityFloor}, found '${nextVersion}'`)
  }

  const guide = readFileSync(guidePath, 'utf8')
  const missingEvidence = documentationEvidence
    .filter(([, pattern]) => !pattern.test(guide))
    .map(([id]) => id)
  if (missingEvidence.length) {
    process.stdout.write(`${JSON.stringify({
      pass: false,
      next_version: nextVersion,
      error: `documentation evidence missing for: ${missingEvidence.join(', ')}`,
      violations: [],
    })}\n`)
    process.exitCode = 2
    return
  }

  const violations: Violation[] = []
  const middlewareFiles = ['middleware.ts', 'middleware.js'].filter((name) => existsSync(join(root, name)))
  for (const name of middlewareFiles) {
    violations.push({
      id: 'NEXT16_MIDDLEWARE_CONVENTION', file: name, line: 1,
      message: "the deprecated middleware file convention must be renamed to proxy",
    })
  }

  const files = collectSourceFiles(root)
  for (const path of files) auditSource(root, path, violations)

  const packagePath = join(root, 'package.json')
  if (existsSync(packagePath)) {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, unknown> }
    for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
      if (typeof command === 'string' && /(^|\s)next\s+lint(?:\s|$)/.test(command)) {
        violations.push({
          id: 'NEXT16_REMOVED_NEXT_LINT', file: 'package.json', line: 1,
          message: `script '${name}' uses the removed next lint command`,
        })
      }
    }
  }

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.id.localeCompare(b.id))
  process.stdout.write(`${JSON.stringify({
    pass: violations.length === 0,
    next_version: nextVersion,
    documentation: relative(root, guidePath).replaceAll('\\', '/'),
    scanned_files: files.length,
    violations,
  })}\n`)
  if (violations.length) process.exitCode = 1
}

try {
  main()
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    pass: false,
    error: error instanceof Error ? error.message : 'unknown audit error',
    violations: [],
  })}\n`)
  process.exitCode = 2
}
