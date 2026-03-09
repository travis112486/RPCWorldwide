import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, requireAuthenticatedUser, createServiceRoleClient } from '@/lib/supabase/auth-helpers'
import {
  getBucketRule,
  inferPortfolioCategory,
  validateMimeFromBytes,
  validateImageContent,
  validatePdfContent,
  validateFileSize,
} from '@/lib/upload/validation'
import { detectMimeFromBytes, normalizeMime } from '@/lib/upload/magic-bytes'

/**
 * POST /api/upload/validate
 *
 * Validates an already-uploaded file's content. Downloads from Supabase
 * Storage, runs validation, and deletes if invalid.
 */
export async function POST(request: NextRequest) {
  // 1. Auth
  const supabase = await createServerSupabaseClient()
  const authResult = await requireAuthenticatedUser(supabase)
  if (authResult.response) return authResult.response
  const userId = authResult.data!.id

  // 2. Parse body
  let body: { bucket?: string; path?: string; category?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON.' },
      { status: 400 },
    )
  }

  const { bucket, path, category } = body

  if (!bucket || !path) {
    return NextResponse.json(
      { error: 'MISSING_FIELDS', message: 'Required fields: bucket, path.' },
      { status: 400 },
    )
  }

  // 3. Verify path belongs to authenticated user
  if (!path.startsWith(`${userId}/`)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'You can only validate your own uploads.' },
      { status: 403 },
    )
  }

  const serviceClient = createServiceRoleClient()

  // 4. Download file from storage
  const { data: blob, error: downloadError } = await serviceClient.storage
    .from(bucket)
    .download(path)

  if (downloadError || !blob) {
    return NextResponse.json(
      { error: 'FILE_NOT_FOUND', message: 'The uploaded file could not be found. It may have expired.' },
      { status: 404 },
    )
  }

  const buffer = Buffer.from(await blob.arrayBuffer())

  // 5. Detect actual MIME type from magic bytes
  const detectedMime = detectMimeFromBytes(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength))
  const normalizedMime = detectedMime ? normalizeMime(detectedMime) : null
  const isImage = normalizedMime?.startsWith('image/')
  const isVideo = normalizedMime?.startsWith('video/')
  const isPdf = normalizedMime === 'application/pdf'

  // 6. Resolve bucket rule
  const resolvedCategory = bucket === 'portfolio'
    ? (category ?? (isImage ? 'image' : isVideo ? 'video' : undefined))
    : undefined
  const rule = getBucketRule(bucket, resolvedCategory)

  if (!rule) {
    await deleteFile(serviceClient, bucket, path)
    return NextResponse.json(
      { error: 'INVALID_CATEGORY', message: 'Could not determine validation rules for this file.' },
      { status: 400 },
    )
  }

  // 7. Validate magic bytes against allowed MIMEs
  const mimeResult = validateMimeFromBytes(
    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    rule.allowedMimes,
  )
  if (!mimeResult.valid) {
    await deleteFile(serviceClient, bucket, path)
    return NextResponse.json(
      { error: mimeResult.error, message: mimeResult.message },
      { status: 422 },
    )
  }

  // 8. Validate file size
  const sizeResult = validateFileSize(buffer.byteLength, rule.maxSize)
  if (!sizeResult.valid) {
    await deleteFile(serviceClient, bucket, path)
    return NextResponse.json(
      { error: sizeResult.error, message: sizeResult.message },
      { status: 413 },
    )
  }

  // 9. Content-specific validation
  if (isImage && rule.maxDimensions) {
    const imageResult = await validateImageContent(
      buffer,
      rule.maxDimensions.width,
      rule.maxDimensions.height,
    )
    if (!imageResult.valid) {
      await deleteFile(serviceClient, bucket, path)
      return NextResponse.json(
        { error: imageResult.error, message: imageResult.message },
        { status: 422 },
      )
    }
  }

  if (isPdf) {
    const pdfResult = validatePdfContent(buffer)
    if (!pdfResult.valid) {
      await deleteFile(serviceClient, bucket, path)
      return NextResponse.json(
        { error: pdfResult.error, message: pdfResult.message },
        { status: 422 },
      )
    }
  }

  // Videos: magic bytes + size already checked above — no deep decode

  return NextResponse.json({ valid: true, path, bucket })
}

/** Helper to delete a file from storage (best-effort, errors are swallowed). */
async function deleteFile(
  client: ReturnType<typeof createServiceRoleClient>,
  bucket: string,
  path: string,
): Promise<void> {
  try {
    await client.storage.from(bucket).remove([path])
  } catch {
    // Best-effort deletion — orphan cleanup cron handles stragglers
  }
}
