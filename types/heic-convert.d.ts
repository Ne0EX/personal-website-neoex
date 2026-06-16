/**
 * Minimal ambient type declaration for `heic-convert`.
 *
 * heic-convert ships no TypeScript types. This stub gives tsc enough
 * information to resolve the module without requiring @types (which does
 * not exist). The real implementation is CJS in node_modules/heic-convert.
 *
 * Verified against node_modules/heic-convert/lib.js and formats-node.js:
 *   - Default export is the `one` async function (single image conversion).
 *   - `buffer` parameter accepts Buffer or Uint8Array (heic-decode contract).
 *   - `format` is 'JPEG' | 'PNG' (formats-node.js keys).
 *   - `quality` is 0-1, defaults to 0.92 internally.
 *   - Return: node build uses jpeg-js which returns a Buffer; declared as
 *     Buffer here (accurate for the node build; browser build differs but
 *     this module is server-only).
 *
 * Owner: Altair (alpha-BND-02) · feat(ingest): heic-hevc 2026-06-16
 */
declare module 'heic-convert' {
  interface ConvertOpts {
    buffer: Buffer | Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number
  }

  /** Convert a single HEIC/HEIF image to JPEG or PNG. Returns a Buffer in Node. */
  function convert(opts: ConvertOpts): Promise<Buffer>

  export default convert
}
