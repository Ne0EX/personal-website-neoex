import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

type Finding = {
  id: string
  file: string
  line: number
  message: string
}
type VoiceLiteral = {
  file: string
  line: number
  text: string
}

const hardPatterns = [
  { id: 'PATTERN-01', pattern: /[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, message: 'emoji is not part of NETRA companion copy' },
  { id: 'PATTERN-02', pattern: /!/g, message: 'exclamation marks break the NETRA register' },
  { id: 'PATTERN-04', pattern: /\b(?:gonna|wanna|kinda|sorta|gotta|ya know)\b/gi, message: 'casual slang breaks the NETRA register' },
  { id: 'PATTERN-05', pattern: /^\s*(?:i(?:'m| am) sorry|sorry,|apologies,)/gi, message: 'NETRA refusals do not open with an apology' },
  { id: 'PATTERN-06', pattern: /outside the worldline\. no signal\./gi, message: 'instrument copy cannot be used as a human-facing refusal' },
  { id: 'PATTERN-07', pattern: /(?:let me know if you want|feel free to ask)/gi, message: 'generic closing filler is not NETRA voice' },
] as const

const modelDisclosure = /(?:as an ai|as a language model|as a chatbot|i am an ai|i'm an ai|i am claude|powered by)/gi

const requiredMarkers = [
  {
    id: 'REQUIRED-01',
    patterns: [/in 003/i, /across the archive/i, /from notes he left here/i, /to me it reads like/i, /the archive does not confirm/i],
    message: 'source-disclosure gradient must name all five canonical cue classes',
  },
  {
    id: 'REQUIRED-02',
    patterns: [/(?:instrument[\s\S]{0,200}refusal|refusal[\s\S]{0,200}instrument)/i],
    message: 'prompt must separate instrument register from human-facing refusals',
  },
  {
    id: 'REQUIRED-03',
    patterns: [/(?:never invent[\s\S]{0,120}(?:archive )?entr|no trace surveyed)/i],
    message: 'prompt must carry an explicit no-hallucination anchor',
  },
  {
    id: 'REQUIRED-04',
    patterns: [/(?:never|do not|avoid|not)[^\n.]{0,160}(?:as an ai|language model|chatbot)/i],
    message: 'prompt must prohibit model disclosure in negative instruction context',
  },
] as const

function parseRoot(argv: string[]): string {
  const index = argv.indexOf('--root')
  if (index === -1) return process.cwd()
  const value = argv[index + 1]
  if (!value) throw new Error('--root requires a directory')
  return value
}

function collectStrings(path: string, declarationNames: Set<string>, propertyNames: Set<string>): VoiceLiteral[] {
  const source = readFileSync(path, 'utf8')
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const selected: ts.Node[] = []

  const findTargets = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && declarationNames.has(node.name.text) && node.initializer) {
      selected.push(node.initializer)
    }
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : ''
      if (propertyNames.has(name)) selected.push(node.initializer)
    }
    ts.forEachChild(node, findTargets)
  }
  findTargets(file)
  if (!selected.length) selected.push(file)

  const literals: VoiceLiteral[] = []
  const extract = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node)
      || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node)
      || ts.isJsxText(node)
    ) {
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
      literals.push({ file: path, line, text: node.getText(file).replace(/^['"`]|['"`]$/g, '') })
    }
    ts.forEachChild(node, extract)
  }
  for (const node of selected) extract(node)
  return literals
}

function isNegativeInstruction(text: string, index: number): boolean {
  const prefix = text.slice(Math.max(0, index - 180), index).toLowerCase()
  const clause = prefix.split(/[.\n;]/).at(-1) ?? prefix
  return /\b(?:never|do not|don't|avoid|not(?:\s+(?:an?|the|a navigator)){0,2})\b/.test(clause)
}

function main(): void {
  const root = parseRoot(process.argv.slice(2))
  const promptPath = join(root, 'lib/netra/prompts/system.ts')
  const voicePath = join(root, 'lib/netra/voice.md')
  const navigatorPath = join(root, 'components/NetraNavigator.tsx')
  const globePath = join(root, 'components/WorldlineGlobe.tsx')
  for (const path of [promptPath, voicePath, navigatorPath, globePath]) {
    if (!existsSync(path)) throw new Error(`required voice contract input is unavailable: ${relative(root, path)}`)
  }

  const voiceSpec = readFileSync(voicePath, 'utf8')
  const declaredIds = [...hardPatterns.map(({ id }) => id), 'PATTERN-03', ...requiredMarkers.map(({ id }) => id)]
  const missingSpecIds = declaredIds.filter((id) => !voiceSpec.includes(id))
  if (missingSpecIds.length) throw new Error(`voice specification is missing contract ids: ${missingSpecIds.join(', ')}`)

  const promptLiterals = collectStrings(promptPath, new Set(['NETRA_SYSTEM_PROMPT']), new Set())
  const literals = [
    ...promptLiterals,
    ...collectStrings(navigatorPath, new Set(['copy']), new Set()),
    ...collectStrings(globePath, new Set(['voice']), new Set(['voice'])),
  ]
  const violations: Finding[] = []

  for (const literal of literals) {
    for (const rule of hardPatterns) {
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags)
      if (pattern.test(literal.text)) {
        violations.push({ id: rule.id, file: relative(root, literal.file).replaceAll('\\', '/'), line: literal.line, message: rule.message })
      }
    }
    for (const match of literal.text.matchAll(new RegExp(modelDisclosure.source, modelDisclosure.flags))) {
      if (!isNegativeInstruction(literal.text, match.index ?? 0)) {
        violations.push({
          id: 'PATTERN-03', file: relative(root, literal.file).replaceAll('\\', '/'), line: literal.line,
          message: 'model disclosure appears outside a negative instruction',
        })
      }
    }
  }

  const prompt = promptLiterals.map(({ text }) => text).join('\n')
  const missingMarkers = requiredMarkers
    .filter(({ patterns }) => patterns.some((pattern) => !pattern.test(prompt)))
    .map(({ id }) => id)

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.id.localeCompare(b.id))
  const exitCode = violations.length ? 1 : missingMarkers.length ? 2 : 0
  process.stdout.write(`${JSON.stringify({
    pass: exitCode === 0,
    contract: 'lib/netra/voice.md',
    scanned_literals: literals.length,
    required_markers: requiredMarkers.map(({ id }) => id),
    missing_markers: missingMarkers,
    violations,
  })}\n`)
  if (exitCode) process.exitCode = exitCode
}

try {
  main()
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    pass: false,
    error: error instanceof Error ? error.message : 'unknown audit error',
    required_markers: [],
    missing_markers: [],
    violations: [],
  })}\n`)
  process.exitCode = 3
}
