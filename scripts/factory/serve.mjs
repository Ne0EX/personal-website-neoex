#!/usr/bin/env node
/**
 * serve.mjs — static server for the soul-factory gallery
 *
 * Serves:  tools/factory/**  at  /
 * Special: GET /data/dashboard.json → .harness/factory/build/dashboard.json (read fresh)
 *
 * Bind: 127.0.0.1 only  |  PORT env (default 4173)
 * Deps: node stdlib only (http, fs, path, url)
 */

import http from 'node:http'
import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// scripts/factory/ → two levels up = project root
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

const STATIC_ROOT   = path.join(PROJECT_ROOT, 'tools', 'factory')
const DASHBOARD_SRC = path.join(PROJECT_ROOT, '.harness', 'factory', 'build', 'dashboard.json')

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.jsx':  'application/javascript; charset=utf-8', // Babel-standalone picks it up via script tags
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return MIME[ext] ?? 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Path-traversal guard
// ---------------------------------------------------------------------------

/**
 * Resolve a URL pathname to a real filesystem path inside `root`.
 * Returns null if the resolved path escapes root (traversal attempt).
 */
function safePath(root, urlPath) {
  // Strip query string just in case (http.IncomingMessage.url may carry it)
  const clean = urlPath.split('?')[0].split('#')[0]
  // Decode percent-encoding; bail on double-encoded sequences
  let decoded
  try {
    decoded = decodeURIComponent(clean)
  } catch {
    return null
  }
  const resolved = path.resolve(root, '.' + decoded)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) return null
  return resolved
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

function handle(req, res) {
  const method = req.method ?? 'GET'
  const url    = req.url   ?? '/'

  // Only GET/HEAD served
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' })
    res.end('Method Not Allowed')
    log(405, method, url)
    return
  }

  // ── Special route: /data/dashboard.json ──────────────────────────────────
  if (url === '/data/dashboard.json' || url.startsWith('/data/dashboard.json?')) {
    let data
    try {
      data = fs.readFileSync(DASHBOARD_SRC)
    } catch (err) {
      const code = err.code === 'ENOENT' ? 404 : 500
      res.writeHead(code, { 'Content-Type': 'text/plain' })
      res.end(code === 404 ? 'dashboard.json not found' : 'Error reading dashboard.json')
      log(code, method, url)
      return
    }
    res.writeHead(200, {
      'Content-Type':  'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': data.length,
    })
    if (method === 'HEAD') { res.end(); log(200, method, url); return }
    res.end(data)
    log(200, method, url)
    return
  }

  // ── Static file serving ───────────────────────────────────────────────────

  // Normalise: "/" → "/index.html"
  let urlPath = url
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html'

  const filePath = safePath(STATIC_ROOT, urlPath)

  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Bad Request')
    log(400, method, url)
    return
  }

  // Check existence / type
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
    log(404, method, url)
    return
  }

  // Directory → try index.html inside it
  let servePath = filePath
  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html')
    try {
      fs.statSync(indexPath)
      servePath = indexPath
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
      log(404, method, url)
      return
    }
  }

  let fileData
  try {
    fileData = fs.readFileSync(servePath)
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
    log(500, method, url)
    return
  }

  res.writeHead(200, {
    'Content-Type':  mimeFor(servePath),
    'Content-Length': fileData.length,
  })
  if (method === 'HEAD') { res.end(); log(200, method, url); return }
  res.end(fileData)
  log(200, method, url)
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(status, method, url) {
  const ts = new Date().toISOString()
  process.stdout.write(`${ts}  ${status}  ${method}  ${url}\n`)
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? '4173', 10)
const HOST = '127.0.0.1'

const server = http.createServer(handle)

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `soul-factory serve · http://${HOST}:${PORT}/\n` +
    `  static root  : ${STATIC_ROOT}\n` +
    `  dashboard src: ${DASHBOARD_SRC}\n`
  )
})

server.on('error', (err) => {
  process.stderr.write(`server error: ${err.message}\n`)
  process.exit(1)
})
