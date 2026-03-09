/**
 * Server-side file validation utilities for upload security.
 *
 * All validation runs AFTER the file is uploaded to Supabase Storage via
 * presigned URL, and BEFORE a database record is created. Files that fail
 * validation are deleted from storage.
 */

import sharp from 'sharp'
import { detectMimeFromBytes, normalizeMime } from './magic-bytes'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; message: string }

// ---------------------------------------------------------------------------
// Bucket configuration
// ---------------------------------------------------------------------------

interface BucketRule {
  maxSize: number
  allowedMimes: string[]
  maxDimensions?: { width: number; height: number }
}

export const BUCKET_CONFIG: Record<string, BucketRule | Record<string, BucketRule>> = {
  avatars: {
    maxSize: 10_000_000,
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
    maxDimensions: { width: 8000, height: 8000 },
  },
  portfolio: {
    image: {
      maxSize: 10_000_000,
      allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
      maxDimensions: { width: 8000, height: 8000 },
    },
    video: {
      maxSize: 100_000_000,
      allowedMimes: ['video/mp4', 'video/quicktime', 'video/webm'],
    },
  },
  resumes: {
    maxSize: 5_000_000,
    allowedMimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
}

/**
 * Resolve the bucket rule for a given bucket + category.
 * Portfolio has sub-categories (image, video); others are flat.
 */
export function getBucketRule(bucket: string, category?: string): BucketRule | null {
  const config = BUCKET_CONFIG[bucket]
  if (!config) return null

  // Flat config (avatars, resumes)
  if ('maxSize' in config) return config as BucketRule

  // Nested config (portfolio) — determine sub-category from MIME or explicit category
  if (category && category in config) return (config as Record<string, BucketRule>)[category]

  return null
}

/**
 * Infer the portfolio sub-category from a MIME type.
 */
export function inferPortfolioCategory(mimeType: string): 'image' | 'video' | null {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  return null
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Validate that the detected MIME (from magic bytes) matches the allowed list.
 */
export function validateMimeFromBytes(
  buffer: Uint8Array,
  allowedMimes: string[],
): ValidationResult {
  const detected = detectMimeFromBytes(buffer)

  if (!detected) {
    return {
      valid: false,
      error: 'UNRECOGNIZED_FILE_TYPE',
      message: 'The file type could not be determined. Please upload a supported file format.',
    }
  }

  const normalizedDetected = normalizeMime(detected)
  const normalizedAllowed = allowedMimes.map(normalizeMime)

  if (!normalizedAllowed.includes(normalizedDetected)) {
    return {
      valid: false,
      error: 'INVALID_FILE_TYPE',
      message: `This file appears to be ${normalizedDetected}, which is not an accepted format. Accepted: ${allowedMimes.join(', ')}.`,
    }
  }

  return { valid: true }
}

/**
 * Validate an image buffer: decode it with sharp and check dimensions.
 */
export async function validateImageContent(
  buffer: Buffer,
  maxWidth: number,
  maxHeight: number,
): Promise<ValidationResult> {
  try {
    const metadata = await sharp(buffer).metadata()

    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: 'INVALID_IMAGE',
        message: 'The file could not be decoded as a valid image.',
      }
    }

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      return {
        valid: false,
        error: 'INVALID_DIMENSIONS',
        message: `Image dimensions (${metadata.width}×${metadata.height}) exceed the maximum allowed (${maxWidth}×${maxHeight}).`,
      }
    }

    return { valid: true }
  } catch {
    return {
      valid: false,
      error: 'INVALID_IMAGE',
      message: 'The file appears to be corrupted and could not be decoded as an image.',
    }
  }
}

/**
 * Scan a PDF buffer for JavaScript, launch actions, and embedded files.
 *
 * Checks for known PDF action keywords that indicate potentially malicious
 * content. This is a heuristic scan, not a full PDF parser.
 */
export function validatePdfContent(buffer: Buffer): ValidationResult {
  const content = buffer.toString('latin1')

  const dangerousPatterns = [
    /\/JS\s/,          // JavaScript action
    /\/JavaScript\s/,  // JavaScript action (alternative)
    /\/AA\s/,          // Additional actions (auto-execute)
    /\/OpenAction\s/,  // Action on document open
    /\/Launch\s/,      // Launch external application
    /\/EmbeddedFile\s/, // Embedded file (potential payload)
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return {
        valid: false,
        error: 'PDF_CONTAINS_SCRIPTS',
        message: 'This PDF contains embedded scripts or actions that are not allowed for security reasons.',
      }
    }
  }

  return { valid: true }
}

/**
 * Validate file size against a maximum.
 */
export function validateFileSize(size: number, maxBytes: number): ValidationResult {
  if (size > maxBytes) {
    const maxMB = (maxBytes / 1_000_000).toFixed(0)
    const actualMB = (size / 1_000_000).toFixed(1)
    return {
      valid: false,
      error: 'FILE_TOO_LARGE',
      message: `File size (${actualMB} MB) exceeds the maximum allowed (${maxMB} MB).`,
    }
  }
  return { valid: true }
}
