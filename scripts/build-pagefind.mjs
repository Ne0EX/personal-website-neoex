#!/usr/bin/env node
/**
 * Build a fresh Pagefind bundle, then replace the generated public snapshot.
 * Pagefind 1.5.2 writes content-addressed files without deleting old hashes.
 * Keep the previous bundle if generation fails; never clean source content.
 * Owner: Procyon · TASK-2026-09-12-PUBLICATION-PAGEFIND
 */
import { execFileSync } from 'node:child_process'
import { access, lstat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../', import.meta.url))
const buildDirectory = path.join(repository, '.next')
const publicDirectory = path.join(repository, 'public')
const outputDirectory = path.join(publicDirectory, 'pagefind')
// The installed package exports lib/index.js; its declared CLI is lib/runner/bin.cjs.
const pagefindCli = fileURLToPath(new URL('./runner/bin.cjs', import.meta.resolve('pagefind')))

async function requireLocalPublicDirectory() {
  await mkdir(publicDirectory, { recursive: true })
  if ((await lstat(publicDirectory)).isSymbolicLink()) {
    throw new Error('Refusing symlinked public directory: generated cleanup must stay inside the repository')
  }
}

async function buildPagefind() {
  await requireLocalPublicDirectory()
  await mkdir(buildDirectory, { recursive: true })
  const temporaryDirectory = await mkdtemp(path.join(buildDirectory, 'pagefind-build-'))
  const stagedDirectory = path.join(temporaryDirectory, 'next')
  const previousDirectory = path.join(temporaryDirectory, 'previous')
  let previousExists = false
  let preserveRecoveryDirectory = false

  try {
    execFileSync(process.execPath, [
      pagefindCli,
      '--site', path.join(buildDirectory, 'server', 'app'),
      '--output-path', stagedDirectory,
    ], { cwd: repository, stdio: 'inherit' })
    await access(path.join(stagedDirectory, 'pagefind-entry.json'))
    await requireLocalPublicDirectory()

    try {
      await rename(outputDirectory, previousDirectory)
      previousExists = true
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }

    try {
      await rename(stagedDirectory, outputDirectory)
    } catch (installError) {
      if (previousExists) {
        try {
          await rename(previousDirectory, outputDirectory)
        } catch (recoveryError) {
          // The old bundle may be the sole recoverable copy: never delete it.
          preserveRecoveryDirectory = true
          throw new AggregateError(
            [installError, recoveryError],
            'Pagefind replacement and rollback failed; previous bundle retained at ' + previousDirectory,
          )
        }
      }
      throw installError
    }

    console.log('[build-pagefind] installed fresh public/pagefind bundle')
  } finally {
    if (!preserveRecoveryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
}

buildPagefind().catch((error) => {
  console.error('[build-pagefind]', error)
  process.exitCode = 1
})
