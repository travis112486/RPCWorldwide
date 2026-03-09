import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, requireAuthenticatedUser, createServiceRoleClient } from '@/lib/supabase/auth-helpers'
import { uploadLimiter, rateLimitResponse } from '@/lib/rate-limit'
import { BUCKET_CONFIG, getBucketRule, inferPortfolioCategory } from '@/lib/upload/validation'

const ALLOWED_BUCKETS = Object.keys(BUCKET_CONFIG)

/** File extension from MIME type (fallback to 'bin') */
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  }
  return map[mime] ?? 'bin'
}

/**
 * POST /api/upload/prepare
 *
 * Validates upload metadata and returns a presigned upload URL.
 * No file bytes transit through this route — only metadata.
 */
export async function POST(request: NextRequest) {
  // 1. Auth
  const supabase = await createServerSupabaseClient()
  const authResult = await requireAuthenticatedUser(supabase)
  if (authResult.response) return authResult.response
  const userId = authResult.data!.id

  // 2. Rate limit
  const rateResult = uploadLimiter.check(userId)
  if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter)

  // 3. Parse body
  let body: { fileName?: string; fileSize?: number; mimeType?: string; bucket?: string; category?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Request body must be valid JSON.' },
      { status: 400 },
    )
  }

  const { fileName, fileSize, mimeType, bucket, category } = body

  if (!fileName || !fileSize || !mimeType || !bucket) {
    return NextResponse.json(
      { error: 'MISSING_FIELDS', message: 'Required fields: fileName, fileSize, mimeType, bucket.' },
      { status: 400 },
    )
  }

  // 4. Validate bucket
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json(
      { error: 'INVALID_BUCKET', message: `Bucket must be one of: ${ALLOWED_BUCKETS.join(', ')}.` },
      { status: 400 },
    )
  }

  // 5. Resolve bucket rule
  const resolvedCategory = bucket === 'portfolio'
    ? (category ?? inferPortfolioCategory(mimeType) ?? undefined)
    : undefined
  const rule = getBucketRule(bucket, resolvedCategory)

  if (!rule) {
    return NextResponse.json(
      { error: 'INVALID_CATEGORY', message: 'Could not determine upload rules for this file type and bucket.' },
      { status: 400 },
    )
  }

  // 6. Validate MIME type
  if (!rule.allowedMimes.includes(mimeType)) {
    return NextResponse.json(
      { error: 'UNSUPPORTED_MIME', message: `File type ${mimeType} is not accepted. Allowed: ${rule.allowedMimes.join(', ')}.` },
      { status: 415 },
    )
  }

  // 7. Validate file size
  if (fileSize > rule.maxSize) {
    const maxMB = (rule.maxSize / 1_000_000).toFixed(0)
    return NextResponse.json(
      { error: 'FILE_TOO_LARGE', message: `File size exceeds the ${maxMB} MB limit.` },
      { status: 413 },
    )
  }

  // 8. Generate storage path
  const ext = extFromMime(mimeType)
  const uniqueId = crypto.randomUUID().slice(0, 8)
  const path = `${userId}/${Date.now()}-${uniqueId}.${ext}`

  // 9. Create signed upload URL via service role (bypasses RLS for URL generation)
  const serviceClient = createServiceRoleClient()
  const { data, error } = await serviceClient.storage
    .from(bucket)
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json(
      { error: 'STORAGE_ERROR', message: 'Failed to generate upload URL. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: data.path,
    token: data.token,
  })
}
