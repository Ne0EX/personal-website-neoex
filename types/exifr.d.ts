/**
 * Minimal ambient type declaration for `exifr`.
 *
 * This stub allows TypeScript to resolve the module when `exifr` is referenced
 * in scripts/process-photos.ts. The full package (npm install exifr) must be
 * installed before running the photo processing pipeline.
 *
 * When exifr is installed, its own type declarations take precedence over this stub.
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-30
 * Flag: npm install exifr required — Canopus co-sign on package.json.
 */
declare module 'exifr' {
  interface ParseOptions {
    pick?: string[]
    makerNote?: boolean
    mergeOutput?: boolean
  }

  interface ExifrDefault {
    parse(
      src: string | ArrayBuffer | Uint8Array | File | Blob,
      options?: ParseOptions,
    ): Promise<Record<string, unknown> | undefined>
  }

  const exifr: ExifrDefault
  export default exifr
}
