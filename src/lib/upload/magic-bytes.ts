/**
 * Magic byte signature detection for file type validation.
 *
 * Detects actual MIME type from file header bytes, independent of the
 * declared Content-Type which is trivially spoofable.
 */

interface Signature {
  mime: string
  /** Byte pattern to match */
  bytes: number[]
  /** Offset from start of file (default 0) */
  offset?: number
  /** Optional secondary check (e.g. WebP requires RIFF + WEBP) */
  secondary?: { bytes: number[]; offset: number }
}

const SIGNATURES: Signature[] = [
  // Images
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  {
    mime: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46], // RIFF
    secondary: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // WEBP at offset 8
  },

  // Video — ftyp box at offset 4 (MP4/MOV family)
  {
    mime: 'video/mp4',
    bytes: [0x66, 0x74, 0x79, 0x70], // "ftyp"
    offset: 4,
  },

  // WebM — EBML header
  { mime: 'video/webm', bytes: [0x1a, 0x45, 0xdf, 0xa3] },

  // Documents
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF

  // OLE2 Compound Document (legacy .doc)
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },

  // ZIP-based (DOCX, XLSX, etc.) — checked further below
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: [0x50, 0x4b, 0x03, 0x04], // PK\x03\x04
  },
]

/**
 * Detect the MIME type of a file from its first bytes.
 *
 * For MP4/MOV detection, both map to 'video/mp4' since the ftyp box is
 * shared. QuickTime MOV files (.mov) use compatible ftyp brands and are
 * treated as 'video/mp4' for validation purposes (both are ISO BMFF).
 *
 * For ZIP-based files (DOCX), only the PK header is checked. A deeper
 * check for `word/document.xml` would require unzipping which is deferred
 * to a follow-up.
 */
export function detectMimeFromBytes(buffer: Uint8Array): string | null {
  if (buffer.length < 12) return null

  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0
    if (buffer.length < offset + sig.bytes.length) continue

    const matches = sig.bytes.every(
      (byte, i) => buffer[offset + i] === byte,
    )

    if (!matches) continue

    // Secondary check (e.g. WebP needs RIFF + WEBP)
    if (sig.secondary) {
      const { bytes: secBytes, offset: secOffset } = sig.secondary
      if (buffer.length < secOffset + secBytes.length) continue
      const secMatches = secBytes.every(
        (byte, i) => buffer[secOffset + i] === byte,
      )
      if (!secMatches) continue
    }

    return sig.mime
  }

  return null
}

/**
 * Map of MIME types that should be treated as equivalent during validation.
 * e.g. video/quicktime (.mov) is structurally identical to video/mp4.
 */
const MIME_EQUIVALENTS: Record<string, string> = {
  'video/quicktime': 'video/mp4',
}

/**
 * Normalize a MIME type using equivalence mappings.
 */
export function normalizeMime(mime: string): string {
  return MIME_EQUIVALENTS[mime] ?? mime
}
