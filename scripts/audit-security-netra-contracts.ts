/**
 * Deterministic source-contract audit for the console security boundary and
 * NETRA. This audit intentionally never imports application modules: doing so
 * would require request cookies, Supabase, Redis, or a model provider.
 *
 * Usage:
 *   npx tsx scripts/audit-security-netra-contracts.ts
 *   npx tsx scripts/audit-security-netra-contracts.ts --scope console
 *   npx tsx scripts/audit-security-netra-contracts.ts --scope netra
 *   npx tsx scripts/audit-security-netra-contracts.ts --root /fixture/root
 *
 * Exit codes:
 *   0 contract satisfied
 *   1 contract violations found
 *   2 audit input/configuration error
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

type Area = 'console' | 'store' | 'route' | 'ui'
type RequestedScope = Area | 'netra' | 'all'

type CheckResult = {
  id: string
  area: Area
  file: string
  status: 'PASS' | 'FAIL'
  detail: string
}

type AuditOutput = {
  audit: 'security-netra-contracts'
  version: 1
  scope: RequestedScope
  pass: boolean
  files_checked: string[]
  checks: CheckResult[]
  violations: CheckResult[]
}

const FILES = {
  actions: 'lib/server/store/actions.ts',
  actionsCore: 'lib/server/store/actions-core.ts',
  auth: 'lib/server/auth.ts',
  store: 'lib/store/netra-reads.ts',
  route: 'app/api/chat/route.ts',
  gateway: 'lib/netra/gateway.ts',
  rateLimit: 'lib/server/rate-limit.ts',
  navigator: 'components/NetraNavigator.tsx',
  navigatorCss: 'components/NetraNavigator.css',
} as const

function parseArguments(argv: string[]): { root: string; scope: RequestedScope } {
  let root = process.cwd()
  let scope: RequestedScope = 'all'

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--root') {
      const value = argv[index + 1]
      if (!value) throw new Error('--root requires a path')
      root = value
      index += 1
      continue
    }
    if (argument === '--scope') {
      const value = argv[index + 1] as RequestedScope | undefined
      if (!value || !['all', 'console', 'store', 'route', 'ui', 'netra'].includes(value)) {
        throw new Error('--scope must be one of: all, console, store, route, ui, netra')
      }
      scope = value
      index += 1
      continue
    }
    throw new Error(`unsupported argument: ${argument}`)
  }

  return { root: resolve(root), scope }
}

function selectedAreas(scope: RequestedScope): Set<Area> {
  if (scope === 'all') return new Set(['console', 'store', 'route', 'ui'])
  if (scope === 'netra') return new Set(['store', 'route', 'ui'])
  return new Set([scope])
}

function exportedFunctionDeclarations(sourceFile: ts.SourceFile): ts.FunctionDeclaration[] {
  return sourceFile.statements.filter((statement): statement is ts.FunctionDeclaration => {
    if (!ts.isFunctionDeclaration(statement) || !statement.name) return false
    return ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
  })
}

function sourceFile(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function jsxElementWithStaticClass(
  file: ts.SourceFile,
  tagName: string,
  className: string,
): ts.JsxElement | null {
  let result: ts.JsxElement | null = null

  const visit = (node: ts.Node): void => {
    if (result) return
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === tagName) {
      const classAttribute = node.openingElement.attributes.properties.find(
        (property): property is ts.JsxAttribute => (
          ts.isJsxAttribute(property) && property.name.getText(file) === 'className'
        ),
      )
      const initializer = classAttribute?.initializer
      if (
        initializer
        && ts.isStringLiteral(initializer)
        && initializer.text.split(/\s+/).includes(className)
      ) {
        result = node
        return
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(file)
  return result
}

function compoundClassRule(source: string, className: string): string {
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  for (const match of source.matchAll(rulePattern)) {
    for (const rawSelector of match[1].split(',')) {
      const selector = rawSelector.trim().replace(/\s+/g, '')
      if (!/^(?:\.[A-Za-z_][\w-]*)+$/.test(selector)) continue
      const classes = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((classMatch) => classMatch[1])
      if (classes.includes(className)) return match[2]
    }
  }
  return ''
}

function firstMatchIndex(source: string, patterns: RegExp[]): number {
  const matches = patterns
    .map((pattern) => source.search(pattern))
    .filter((index) => index >= 0)
  return matches.length ? Math.min(...matches) : -1
}

function pxValue(value: string): number | null {
  const match = value.match(/(?:^|\s)(\d*\.?\d+)(px|rem)(?=\/|\s|$)/)
  if (!match) return null
  const number = Number(match[1])
  return match[2] === 'rem' ? number * 16 : number
}

function objectPropertyName(
  property: ts.ObjectLiteralElementLike,
  file: ts.SourceFile,
): string | null {
  if (ts.isSpreadAssignment(property)) return null
  const name = property.name
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return name.getText(file)
}

function objectProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
  file: ts.SourceFile,
): ts.ObjectLiteralElementLike | undefined {
  return object.properties.find((property) => objectPropertyName(property, file) === name)
}

function auditMain(): AuditOutput {
  const { root, scope } = parseArguments(process.argv.slice(2))
  const areas = selectedAreas(scope)
  const checks: CheckResult[] = []
  const filesChecked = new Set<string>()

  function add(area: Area, id: string, file: string, condition: boolean, passDetail: string, failDetail: string): void {
    filesChecked.add(file)
    checks.push({ id, area, file, status: condition ? 'PASS' : 'FAIL', detail: condition ? passDetail : failDetail })
  }

  function read(relativePath: string, area: Area): string {
    filesChecked.add(relativePath)
    try {
      return readFileSync(resolve(root, relativePath), 'utf8')
    } catch (error) {
      add(area, 'SOURCE_AVAILABLE', relativePath, false, '', `required source is unavailable: ${error instanceof Error ? error.message : String(error)}`)
      return ''
    }
  }

  if (areas.has('console')) {
    const actionsSource = read(FILES.actions, 'console')
    const coreSource = read(FILES.actionsCore, 'console')
    const authSource = read(FILES.auth, 'console')
    const actionsFile = sourceFile(FILES.actions, actionsSource)
    const coreFile = sourceFile(FILES.actionsCore, coreSource)
    const wrappers = exportedFunctionDeclarations(actionsFile)
    const implementations = exportedFunctionDeclarations(coreFile).filter((node) => node.name?.text.endsWith('Impl'))

    add(
      'console',
      'CONSOLE_SERVER_ACTION_MODULE',
      FILES.actions,
      actionsFile.statements[0] !== undefined && ts.isExpressionStatement(actionsFile.statements[0]) && actionsFile.statements[0].expression.getText(actionsFile) === "'use server'",
      'the active wrapper module is explicitly server-only',
      "the active wrapper module must begin with the 'use server' directive",
    )

    const wrapperTargets = new Map<string, string>()
    for (const wrapper of wrappers) {
      const name = wrapper.name?.text ?? '<anonymous>'
      const parameter = wrapper.parameters[0]
      const returnStatement = wrapper.body?.statements.find(ts.isReturnStatement)
      const expression = returnStatement?.expression
      const target = expression && ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
        ? expression.expression.text
        : ''
      if (target) wrapperTargets.set(name, target)

      const acceptsUnknown = parameter?.type?.getText(actionsFile) === 'unknown'
      const returnsEnvelope = wrapper.type?.getText(actionsFile).match(/^Promise<\w+Result>$/) !== null
      add(
        'console',
        `CONSOLE_WRAPPER_${name}`,
        FILES.actions,
        Boolean(parameter && acceptsUnknown && returnsEnvelope && target === `${name}Impl`),
        `${name} accepts unknown input and delegates to its typed ${name}Impl envelope`,
        `${name} must accept unknown input, return Promise<*Result>, and only delegate to ${name}Impl`,
      )
    }

    const implementationNames = implementations.map((node) => node.name?.text ?? '').sort()
    const targetNames = [...wrapperTargets.values()].sort()
    add(
      'console',
      'CONSOLE_ACTIVE_ACTION_DENOMINATOR',
      FILES.actions,
      implementationNames.length > 0 && JSON.stringify(implementationNames) === JSON.stringify(targetNames),
      `${implementationNames.length} active implementations have exactly one server-action wrapper`,
      `active wrapper/implementation sets differ: implementations=${implementationNames.join(',') || 'none'} wrappers=${targetNames.join(',') || 'none'}`,
    )

    for (const implementation of implementations) {
      const name = implementation.name?.text ?? '<anonymous>'
      const statements = implementation.body?.statements ?? []
      const firstFour = statements.slice(0, 4).map((statement) => statement.getText(coreFile))
      const authFirst = /^const auth = await assertOwner\(\)$/.test(firstFour[0] ?? '')
      const authGuardSecond = /^if \(!auth\.ok\) return auth$/.test(firstFour[1] ?? '')
      const validatesThird = /^const parsed = \w+Schema\.safeParse\(rawInput\)$/.test(firstFour[2] ?? '')
      const validationGuardFourth = /^if \(!parsed\.success\) return err\(/.test(firstFour[3] ?? '')
      const parameterIsUnknown = implementation.parameters[0]?.type?.getText(coreFile) === 'unknown'
      const returnTypeIsEnvelope = implementation.type?.getText(coreFile).match(/^Promise<\w+Result>$/) !== null

      add(
        'console',
        `CONSOLE_IMPL_ORDER_${name}`,
        FILES.actionsCore,
        authFirst && authGuardSecond && validatesThird && validationGuardFourth,
        `${name} authorizes, bails, validates, and bails before any action body`,
        `${name} must begin with assertOwner → failed-auth return → Schema.safeParse(rawInput) → failed-validation return`,
      )
      add(
        'console',
        `CONSOLE_IMPL_ENVELOPE_${name}`,
        FILES.actionsCore,
        parameterIsUnknown && returnTypeIsEnvelope,
        `${name} treats input as unknown and exposes a named constrained result`,
        `${name} must accept unknown and return Promise<*Result> rather than a raw store record`,
      )
    }

    add(
      'console',
      'CONSOLE_AUTH_VERIFIED_USER',
      FILES.auth,
      /supabase\.auth\.getUser\(\)/.test(authSource) && !/\.getSession\(/.test(authSource),
      'assertOwner verifies the user with getUser and never authorizes from getSession',
      'assertOwner must call getUser() and must not call getSession()',
    )
    add(
      'console',
      'CONSOLE_AUTH_OWNER_RPC',
      FILES.auth,
      /\.rpc\(\s*['"]is_owner['"]\s*\)/.test(authSource),
      'assertOwner performs the owner authorization RPC',
      "assertOwner must authorize with rpc('is_owner') after authentication",
    )
    add(
      'console',
      'CONSOLE_ERROR_ENVELOPE',
      FILES.actionsCore,
      /type ActionError\s*=\s*\{[\s\S]*?ok:\s*false[\s\S]*?error:\s*\{[\s\S]*?code:\s*string;[\s\S]*?message:\s*string;[\s\S]*?details\?:\s*unknown/.test(coreSource)
        && /return \{ ok: false, error: \{ code, message, details \} \}/.test(coreSource),
      'failures cross the action boundary in the constrained error envelope',
      'ActionError/err must constrain failures to ok, code, message, and optional details',
    )
  }

  if (areas.has('store')) {
    const storeSource = read(FILES.store, 'store')
    const storeFile = sourceFile(FILES.store, storeSource)
    const exportedReads = exportedFunctionDeclarations(storeFile)
    const resultColumns = storeSource.match(/const RESULT_COLUMNS\s*=\s*['"]([^'"]+)['"]/)?.[1]
      ?.split(',')
      .map((column) => column.trim())
      .filter(Boolean) ?? []
    const patchSuffix = storeSource.match(/const PATCH_COLUMNS\s*=\s*`\$\{RESULT_COLUMNS\},([^`]+)`/)?.[1]
      ?.split(',')
      .map((column) => column.trim())
      .filter(Boolean) ?? []
    const forbiddenColumns = ['*', 'status', 'draft', 'owner_id', 'user_id', 'email', 'private_notes']
    const projectionColumns = [...resultColumns, ...patchSuffix]
    const selectArguments: string[] = []
    const collectSelects = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'select'
      ) {
        selectArguments.push(node.arguments[0]?.getText(storeFile) ?? '')
      }
      ts.forEachChild(node, collectSelects)
    }
    collectSelects(storeFile)
    const projectionsAreNamed = selectArguments.length > 0
      && selectArguments.every((argument) => argument === 'RESULT_COLUMNS' || argument === 'PATCH_COLUMNS')
    const projectionSafe = resultColumns.length > 0
      && patchSuffix.length === 1
      && patchSuffix[0] === 'patches'
      && forbiddenColumns.every((column) => !projectionColumns.includes(column))

    add(
      'store',
      'STORE_EXPLICIT_PUBLIC_PROJECTION',
      FILES.store,
      projectionSafe && projectionsAreNamed && !/\.select\(\s*['"]\*['"]\s*\)/.test(storeSource),
      `NETRA reads use RESULT_COLUMNS (${resultColumns.length}) and PATCH_COLUMNS (+patches) without draft/private control fields`,
      `NETRA reads must select only RESULT_COLUMNS/PATCH_COLUMNS; PATCH_COLUMNS may add only patches; forbidden: ${forbiddenColumns.join(', ')}; observed selects=${selectArguments.join(', ') || 'none'}`,
    )
    add(
      'store',
      'STORE_RLS_REQUEST_CLIENT',
      FILES.store,
      exportedReads.length > 0
        && exportedReads.every((node) => node.parameters[0]?.type?.getText(storeFile) === 'NetraClient')
        && !/(createClient|createServerClient|SUPABASE_SECRET_KEY|service[_-]?role|\.schema\(\s*['"]private)/i.test(storeSource),
      `${exportedReads.length} exported reads require the request-scoped client and contain no privileged client escape hatch`,
      'every exported read must receive NetraClient as its first argument and must not construct/use a service or private-schema client',
    )

    const searchEntries = exportedReads.find((node) => node.name?.text === 'searchEntries')
    const searchFilter = storeFile.statements.find(
      (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'searchFilter',
    )
    const searchBody = searchEntries?.body?.getText(storeFile) ?? ''
    const searchFilterBody = searchFilter?.body?.getText(storeFile) ?? ''
    let orArgument = ''
    if (searchEntries?.body) {
      const visit = (node: ts.Node): void => {
        if (
          !orArgument
          && ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && node.expression.name.text === 'or'
        ) {
          orArgument = node.arguments[0]?.getText(storeFile) ?? ''
        }
        ts.forEachChild(node, visit)
      }
      visit(searchEntries.body)
    }
    const filterBinding = searchBody.match(/\bconst\s+(\w+)\s*=\s*searchFilter\(\s*query\s*\)/)?.[1] ?? ''
    const fixedSearchColumns = storeSource.match(/const SEARCH_COLUMNS\s*=\s*\[([^\]]+)\]/)?.[1]
      ?.match(/['"]([^'"]+)['"]/g)
      ?.map((column) => column.slice(1, -1)) ?? []
    const helperIsBounded = Boolean(searchFilter)
      && searchFilter?.parameters[0]?.name.getText(storeFile) === 'query'
      && /MAX_SEARCH_QUERY_LENGTH/.test(searchFilterBody)
      && /MAX_SEARCH_TOKENS/.test(searchFilterBody)
      && /MAX_SEARCH_TOKEN_LENGTH/.test(searchFilterBody)
      && /SEARCH_TOKEN_PATTERN/.test(searchFilterBody)
      && /SEARCH_COLUMNS/.test(searchFilterBody)
    const rawQueryAbsent = orArgument.length > 0 && !/\bquery\b/.test(orArgument)
    const transformedQueryPresent = filterBinding.length > 0 && orArgument === filterBinding
    const fixedColumnsOnly = JSON.stringify(fixedSearchColumns) === JSON.stringify(['title', 'summary', 'body'])
    add(
      'store',
      'STORE_SEARCH_FILTER_INPUT',
      FILES.store,
      rawQueryAbsent && transformedQueryPresent && helperIsBounded && fixedColumnsOnly,
      'searchEntries passes searchFilter(query) output to .or(); the helper bounds Unicode word tokens and uses fixed public columns',
      `searchEntries must bind bounded searchFilter(query) output before .or(); fixed columns must be title/summary/body; observed argument=${orArgument || 'missing'} columns=${fixedSearchColumns.join(',') || 'missing'}`,
    )
    add(
      'store',
      'STORE_RESULT_MINIMIZATION',
      FILES.store,
      /\.slice\(0,\s*800\)/.test(storeSource)
        && /return \{[\s\S]*?title:[\s\S]*?slug:[\s\S]*?lang:[\s\S]*?summary:[\s\S]*?excerpt:[\s\S]*?permalink:[\s\S]*?\}/.test(storeSource),
      'tool results are explicitly mapped and excerpts are capped at 800 characters',
      'NETRA store results must be explicitly mapped to title/slug/lang/summary/excerpt/permalink with excerpt capped at 800',
    )
  }

  if (areas.has('route')) {
    const routeSource = read(FILES.route, 'route')
    const gatewaySource = read(FILES.gateway, 'route')
    const rateLimitSource = read(FILES.rateLimit, 'route')
    const routeFile = sourceFile(FILES.route, routeSource)
    const post = exportedFunctionDeclarations(routeFile).find((node) => node.name?.text === 'POST')
    const postBody = post?.body?.getText(routeFile) ?? ''
    const parseIndex = firstMatchIndex(postBody, [
      /ChatRequestSchema\.parse\(\s*await request\.json\(\)\s*\)/,
      /ChatRequestSchema\.safeParse\(\s*await request\.json\(\)\s*\)/,
    ])
    const quotaIndex = postBody.search(/await quota\(/)
    const pageResolveIndex = postBody.search(/const page\s*=\s*resolveNetraPageContext\(/)
    const pageGuardIndex = postBody.search(/if \(page\.kind === ['"]unknown['"]\)/)

    add(
      'route',
      'NETRA_ROUTE_VALIDATE_BEFORE_QUOTA',
      FILES.route,
      parseIndex >= 0 && quotaIndex >= 0 && parseIndex < quotaIndex,
      'the request body is parsed and validated before quota is consumed',
      `ChatRequestSchema validation must precede await quota(); parse_index=${parseIndex} quota_index=${quotaIndex}`,
    )
    add(
      'route',
      'NETRA_ROUTE_PAGE_VALIDATE_BEFORE_QUOTA',
      FILES.route,
      /page:\s*z\.object\(\{\s*pathname:\s*z\.string\(\)\.min\(1\)\.max\(NETRA_MAX_PATHNAME_LENGTH\)/.test(routeSource)
        && parseIndex >= 0
        && pageResolveIndex > parseIndex
        && pageGuardIndex > pageResolveIndex
        && quotaIndex > pageGuardIndex
        && /if \(page\.kind === ['"]unknown['"]\)\s*\{\s*return errorResponse\(400, ['"]INVALID_BODY['"]/.test(postBody),
      'bounded pathname schema and finite public-page resolution both reject before quota consumption',
      `page.pathname must be bounded by NETRA_MAX_PATHNAME_LENGTH, then resolveNetraPageContext + unknown-page rejection must precede await quota(); parse=${parseIndex} resolve=${pageResolveIndex} guard=${pageGuardIndex} quota=${quotaIndex}`,
    )
    const coreCallIndex = postBody.search(/await runNetraTurn\(/)
    add(
      'route',
      'NETRA_ROUTE_CORE_DELEGATION',
      FILES.route,
      coreCallIndex > quotaIndex
        && /messages:\s*parsed\.messages/.test(postBody)
        && /servedLang:\s*parsed\.served_lang/.test(postBody)
        && /page:\s*parsed\.page/.test(postBody)
        && /abortSignal:\s*request\.signal/.test(postBody)
        && /model:\s*gatewayRuntime\.model/.test(postBody)
        && /providerOptions:\s*gatewayRuntime\.providerOptions/.test(postBody)
        && /\bknowledge\s*,/.test(postBody)
        && !/\bstreamText\s*\(/.test(routeSource)
        && !/\b(?:NETRA_SYSTEM_PROMPT|createNetraTools|netraTools|experimental_context)\b/.test(routeSource),
      'the route delegates normalized turn input, model, and knowledge to runNetraTurn without assembling prompt/tools',
      'route must call runNetraTurn with parsed messages/lang/page, request.signal, model, and knowledge; route-owned streamText/prompt/tool/context assembly is forbidden',
    )
    add(
      'route',
      'NETRA_ROUTE_SESSION_ID',
      FILES.rateLimit,
      /resolveSessionId/.test(routeSource)
        && /request\.cookies\.get\(\s*SESSION_COOKIE_NAME\s*\)\?\.value/.test(routeSource)
        && /SESSION_ID_PATTERN/.test(rateLimitSource)
        && /SESSION_ID_PATTERN\.test\(value\)/.test(rateLimitSource)
        && /crypto\.randomUUID\(\)/.test(rateLimitSource)
        && /if \(!isValidSessionId\(generated\)\)/.test(rateLimitSource)
        && !/cookies\.get\([\s\S]{0,120}\?\.value\s*\?\?\s*crypto\.randomUUID\(\)/.test(postBody),
      'the route delegates cookie canonicalization to resolveSessionId; the helper validates both cookie and generated UUIDv4 values',
      'route must call resolveSessionId(cookie); rate-limit helper must validate cookie and generated UUIDv4 values; direct cookie ?? randomUUID is forbidden',
    )
    add(
      'route',
      'NETRA_ROUTE_SESSION_TTL',
      FILES.rateLimit,
      /RATE_LIMIT_WINDOW_MS/.test(routeSource)
        && /SESSION_WINDOW_SECONDS\s*=\s*Math\.floor\(RATE_LIMIT_WINDOW_MS\s*\/\s*1000\)/.test(routeSource)
        && /['"]EXPIRE['"]\s*,\s*sessionKey\s*,\s*String\(SESSION_WINDOW_SECONDS\)/.test(routeSource)
        && /RATE_LIMIT_WINDOW_MS\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(rateLimitSource),
      'the per-session Redis TTL derives from the shared 24-hour RATE_LIMIT_WINDOW_MS contract',
      'route must derive SESSION_WINDOW_SECONDS from RATE_LIMIT_WINDOW_MS and EXPIRE the session key; helper must define the 24-hour window',
    )
    const freeModelBlock = gatewaySource.match(
      /NETRA_FREE_GATEWAY_MODELS\s*=\s*\[([\s\S]*?)\]\s*as const/,
    )?.[1] ?? ''
    const freeModels = [...freeModelBlock.matchAll(/['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
    const defaultModel = gatewaySource.match(
      /NETRA_DEFAULT_FREE_GATEWAY_MODEL[^=]*=\s*['"]([^'"]+)['"]/,
    )?.[1] ?? ''
    add(
      'route',
      'NETRA_ROUTE_GATEWAY_FREE_ONLY',
      FILES.gateway,
      freeModels.length > 0
        && freeModels.every((model) => model.endsWith('-free'))
        && new Set(freeModels).size === freeModels.length
        && freeModels.includes(defaultModel)
        && /gateway\(modelId\)/.test(gatewaySource)
        && /models:\s*fallbackModels/.test(gatewaySource)
        && /user:\s*input\.sessionId/.test(gatewaySource)
        && /['"]feature:netra['"]/.test(gatewaySource)
        && /['"]tier:free-only['"]/.test(gatewaySource)
        && /createNetraGatewayRuntime\(\{[\s\S]*?configuredModel:\s*process\.env\.NETRA_MODEL[\s\S]*?sessionId/.test(postBody)
        && !/createOpenRouter|OPENROUTER_API_KEY|@openrouter\//.test(routeSource + gatewaySource),
      `Vercel AI Gateway allowlist contains ${freeModels.length} zero-priced -free model(s), with session attribution and free-only tagging`,
      `route must use createNetraGatewayRuntime; every allowed/fallback model must end in -free; default must be allowlisted; OpenRouter imports and keys are forbidden; observed=${freeModels.join(',') || 'missing'}`,
    )
    add(
      'route',
      'NETRA_ROUTE_GATEWAY_ATTRIBUTION',
      FILES.route,
      /const sessionCookie\s*=\s*buildSessionCookie\(quotaResult\.sessionId\)/.test(postBody)
        && /createNetraGatewayRuntime\(\{[\s\S]*?configuredModel:\s*process\.env\.NETRA_MODEL[\s\S]*?sessionId:\s*quotaResult\.sessionId[\s\S]*?\}\)/.test(postBody),
      'the Gateway request attribution and Set-Cookie header use the same post-quota canonical session ID',
      'createNetraGatewayRuntime sessionId and buildSessionCookie must both use quotaResult.sessionId',
    )
    add(
      'route',
      'NETRA_ROUTE_ERROR_ENVELOPE',
      FILES.route,
      /Response\.json\(\s*\{\s*error:\s*\{\s*code,\s*message/.test(routeSource)
        && !/return\s+(?:errorResponse|Response\.json|new Response)\([^\n]*(?:error\.message|error\.stack|String\(error\))/.test(routeSource),
      'client errors use the constrained code/message envelope without provider exception text',
      'all client errors must use {error:{code,message,details?}} and must not include provider exception messages/stacks',
    )
    const safeLoggerBody = routeSource.match(/function logSafeError\([^)]*\)[^{]*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    add(
      'route',
      'NETRA_ROUTE_FIXED_UPSTREAM_COPY',
      FILES.route,
      /UPSTREAM_UNAVAILABLE/.test(routeSource)
        && /signal lost · α holding · try again/.test(routeSource)
        && /logSafeError\(/.test(routeSource)
        && /console\.error\(/.test(safeLoggerBody)
        && /error instanceof Error \? error\.name : typeof error/.test(safeLoggerBody)
        && !/(?:error\.message|error\.stack|String\(error\))/.test(safeLoggerBody),
      'upstream failures expose fixed copy and log only the exception type/name',
      'upstream failures must return fixed copy and call logSafeError; that helper may include only exception type/name, never provider details',
    )
  }

  if (areas.has('ui')) {
    const navigatorSource = read(FILES.navigator, 'ui')
    const cssSource = read(FILES.navigatorCss, 'ui')
    const navigatorFile = sourceFile(FILES.navigator, navigatorSource)
    const triggerNode = jsxElementWithStaticClass(navigatorFile, 'button', 'netra-trigger')
    const trigger = triggerNode?.getText(navigatorFile) ?? ''

    add(
      'ui',
      'NETRA_UI_TRIGGER_IDENTITY_STATE',
      FILES.navigator,
      /aria-expanded=\{open\}/.test(trigger)
        && /aria-controls=/.test(trigger)
        && /data-state=\{state\}/.test(trigger)
        && /aria-label=\{[^}]*stateLabel/.test(trigger)
        && /t\.open/.test(trigger)
        && /t\.close/.test(trigger),
      'the icon trigger has a state-aware NETRA accessible name plus expanded, controls, and data-state semantics',
      'the icon-only NETRA trigger must keep a state-aware open/close accessible name, aria-expanded, aria-controls, and data-state',
    )
    add(
      'ui',
      'NETRA_UI_TRIGGER_BUSY_ARIA',
      FILES.navigator,
      /aria-busy=\{busy\}/.test(trigger),
      'the trigger exposes its busy state to assistive technology',
      'the NETRA trigger must set aria-busy={busy}',
    )

    const triggerRule = compoundClassRule(cssSource, 'netra-trigger')
    const width = triggerRule.match(/(?:^|;)\s*(?:min-)?width\s*:\s*([^;]+)/)?.[1]
    const height = triggerRule.match(/(?:^|;)\s*(?:min-)?height\s*:\s*([^;]+)/)?.[1]
    const widthPx = width ? pxValue(` ${width.trim()} `) : null
    const heightPx = height ? pxValue(` ${height.trim()} `) : null
    add(
      'ui',
      'NETRA_UI_TRIGGER_TARGET',
      FILES.navigatorCss,
      widthPx !== null && heightPx !== null && widthPx >= 44 && heightPx >= 44,
      `trigger target is ${widthPx}×${heightPx}px`,
      `trigger target must be at least 44×44px; observed ${widthPx ?? 'unknown'}×${heightPx ?? 'unknown'}px`,
    )
    add(
      'ui',
      'NETRA_UI_DIALOG_KEYBOARD',
      FILES.navigator,
      /role=["']dialog["']/.test(navigatorSource)
        && /aria-modal=["']true["']/.test(navigatorSource)
        && /event\.key === ['"]Escape['"]/.test(navigatorSource)
        && /event\.key !== ['"]Tab['"]/.test(navigatorSource)
        && /triggerRef\.current\?\.focus\(\)/.test(navigatorSource),
      'dialog semantics, focus trap, Escape, and focus restoration are present',
      'the open panel must be a modal dialog with Tab trapping, Escape close, and trigger focus restoration',
    )
    add(
      'ui',
      'NETRA_UI_LIVE_STATES',
      FILES.navigator,
      /aria-live=/.test(navigatorSource)
        && /aria-busy=\{busy\}/.test(navigatorSource)
        && /role=["']status["']/.test(navigatorSource)
        && /role=["']alert["']/.test(navigatorSource),
      'streaming/busy status and errors have explicit live-region semantics',
      'the panel must expose aria-live, aria-busy, role=status, and role=alert states',
    )
    add(
      'ui',
      'NETRA_UI_STRUCTURED_HTTP_ERRORS',
      FILES.navigator,
      /response\.ok/.test(navigatorSource)
        && (
          /await response\.json\(\)/.test(navigatorSource)
          || (/await response\.text\(\)/.test(navigatorSource) && /JSON\.parse\(/.test(navigatorSource))
        )
        && (
          /error\.(?:message|code)/.test(navigatorSource)
          || (
            /errorCodeFrom\(payload\)/.test(navigatorSource)
            && /return \{ code, message:/.test(navigatorSource)
            && /setProblem\(error\)/.test(navigatorSource)
            && /problem\.code/.test(navigatorSource)
            && /problem\.message/.test(navigatorSource)
          )
        ),
      'non-2xx responses parse and surface the structured route error',
      'non-2xx handling must parse JSON (response.json or response.text + JSON.parse) and surface error.message/code rather than collapsing every failure to offline',
    )
    add(
      'ui',
      'NETRA_UI_HISTORY',
      FILES.navigator,
      /localStorage\.getItem\(\s*['"]wl-netra-history['"]\s*\)/.test(navigatorSource)
        && /localStorage\.setItem\(\s*['"]wl-netra-history['"]/.test(navigatorSource)
        && /localStorage\.removeItem\(\s*['"]wl-netra-history['"]\s*\)/.test(navigatorSource)
        && /setMessages\(\[\]\)/.test(navigatorSource),
      'history hydrates, persists, and has an explicit local clear action',
      'NETRA history must hydrate/get, persist/set, and clear via removeItem plus setMessages([])',
    )
    add(
      'ui',
      'NETRA_UI_TRANSPORT',
      FILES.navigator,
      /fetch\(\s*['"]\/api\/chat['"]/.test(navigatorSource)
        && /method:\s*['"]POST['"]/.test(navigatorSource)
        && /['"]Content-Type['"]:\s*['"]application\/json['"]/.test(navigatorSource)
        && /messages:\s*\w+\.slice\(-10\)/.test(navigatorSource)
        && /served_lang:\s*locale/.test(navigatorSource),
      'the panel posts the bounded message window and page locale to /api/chat',
      'transport must POST JSON to /api/chat with the last 10 messages and served_lang',
    )

    let transportPayload: ts.ObjectLiteralExpression | null = null
    const findTransportPayload = (node: ts.Node): void => {
      if (
        !transportPayload
        && ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText(navigatorFile) === 'JSON'
        && node.expression.name.text === 'stringify'
        && ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        const candidate = node.arguments[0]
        const keys = candidate.properties.map((property) => objectPropertyName(property, navigatorFile))
        if (keys.includes('messages') && keys.includes('served_lang') && keys.includes('page')) {
          transportPayload = candidate
        }
      }
      ts.forEachChild(node, findTransportPayload)
    }
    findTransportPayload(navigatorFile)

    const payload = transportPayload as ts.ObjectLiteralExpression | null
    const payloadKeys = payload
      ? payload.properties.map((property) => objectPropertyName(property, navigatorFile)).sort()
      : []
    const messagesProperty = payload ? objectProperty(payload, 'messages', navigatorFile) : undefined
    const servedLangProperty = payload ? objectProperty(payload, 'served_lang', navigatorFile) : undefined
    const pageProperty = payload ? objectProperty(payload, 'page', navigatorFile) : undefined
    const pageObject = pageProperty
      && ts.isPropertyAssignment(pageProperty)
      && ts.isObjectLiteralExpression(pageProperty.initializer)
      ? pageProperty.initializer
      : null
    const pageKeys = pageObject
      ? pageObject.properties.map((property) => objectPropertyName(property, navigatorFile)).sort()
      : []
    const pathnameProperty = pageObject ? objectProperty(pageObject, 'pathname', navigatorFile) : undefined
    const directPathname = Boolean(
      pathnameProperty
      && (
        ts.isShorthandPropertyAssignment(pathnameProperty)
        || (
          ts.isPropertyAssignment(pathnameProperty)
          && pathnameProperty.initializer.getText(navigatorFile) === 'pathname'
        )
      ),
    )
    const directMessages = Boolean(
      messagesProperty
      && ts.isPropertyAssignment(messagesProperty)
      && /^next\.slice\(-10\)$/.test(messagesProperty.initializer.getText(navigatorFile)),
    )
    const directLocale = Boolean(
      servedLangProperty
      && ts.isPropertyAssignment(servedLangProperty)
      && servedLangProperty.initializer.getText(navigatorFile) === 'locale',
    )
    const forbiddenContextCapture = /document\.title|document\.body\.(?:innerText|textContent|innerHTML)|navigator\.permissions|permissions\.query|\b(?:toolChoice|tool_choice|requestedTool|pageBody|bodyText)\b/.test(navigatorSource)
    add(
      'ui',
      'NETRA_UI_PATHNAME_ONLY_CONTEXT',
      FILES.navigator,
      /import\s*\{\s*usePathname\s*\}\s*from\s*['"]next\/navigation['"]/.test(navigatorSource)
        && /const pathname\s*=\s*usePathname\(\)/.test(navigatorSource)
        && JSON.stringify(payloadKeys) === JSON.stringify(['messages', 'page', 'served_lang'])
        && JSON.stringify(pageKeys) === JSON.stringify(['pathname'])
        && directPathname
        && directMessages
        && directLocale
        && !forbiddenContextCapture,
      'the client sends the current usePathname value as the only page hint beside bounded messages and locale',
      `chat JSON must contain exactly messages=next.slice(-10), served_lang=locale, page={pathname}; DOM/title/permissions/tool-choice capture is forbidden; payload=${payloadKeys.join(',') || 'missing'} page=${pageKeys.join(',') || 'missing'}`,
    )

    const smallText: Array<{ selector: string; size: number }> = []
    const cssRulePattern = /([^{}]+)\{([^{}]*)\}/g
    for (const match of cssSource.matchAll(cssRulePattern)) {
      const selector = match[1].trim()
      if (!selector.includes('.netra-') || selector.includes('.netra-status-mark')) continue
      const declarations = match[2]
      for (const fontMatch of declarations.matchAll(/(?:^|;)\s*(font(?:-size)?)\s*:\s*([^;]+)/g)) {
        const size = pxValue(` ${fontMatch[2].trim()} `)
        if (size !== null && size < 12) smallText.push({ selector, size })
      }
    }
    add(
      'ui',
      'NETRA_UI_LEGIBLE_LABELS',
      FILES.navigatorCss,
      smallText.length === 0,
      'all numeric NETRA text declarations meet the 12px desktop legibility floor',
      `text below 12px: ${smallText.map(({ selector, size }) => `${selector}=${size}px`).join(', ')}`,
    )

    const reducedMotion = cssSource.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}\s*$/)?.[1] ?? ''
    const reducedTransitionIsSuppressed = /transition:\s*none/.test(reducedMotion)
      || [...reducedMotion.matchAll(/transition-duration:\s*(\d*\.?\d+)(ms|s)/g)].some((match) => {
        const durationMs = Number(match[1]) * (match[2] === 's' ? 1000 : 1)
        return Number.isFinite(durationMs) && durationMs <= 1
      })
    add(
      'ui',
      'NETRA_UI_REDUCED_MOTION',
      FILES.navigatorCss,
      reducedMotion.length > 0 && /animation:\s*none/.test(reducedMotion) && reducedTransitionIsSuppressed,
      'reduced-motion removes both animation and transition movement',
      'the reduced-motion block must disable animation and suppress transition movement (none or <=1ms)',
    )
  }

  const violations = checks.filter((check) => check.status === 'FAIL')
  return {
    audit: 'security-netra-contracts',
    version: 1,
    scope,
    pass: violations.length === 0,
    files_checked: [...filesChecked].sort(),
    checks,
    violations,
  }
}

try {
  const output = auditMain()
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
  process.exitCode = output.pass ? 0 : 1
} catch (error) {
  process.stderr.write(`[audit-security-netra-contracts] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 2
}
