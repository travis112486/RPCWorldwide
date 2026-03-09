/**
 * Client-side secure upload helper.
 *
 * Replaces direct supabase.storage.from(bucket).upload() calls with a
 * two-phase flow: prepare → upload → validate.
 */

interface UploadParams {
  file: File
  bucket: string
  category?: string // 'headshot' | 'lifestyle' | 'demo_reel' | 'resume'
  /** @deprecated Server determines user from auth cookies. Kept for caller convenience but unused. */
  userId?: string
  onProgress?: (pct: number) => void
}

type UploadResult =
  | { path: string; error?: undefined }
  | { path?: undefined; error: string }

/**
 * Upload a file securely through the two-phase presigned URL flow.
 *
 * 1. POST /api/upload/prepare — metadata validation, returns signed URL
 * 2. PUT to signed URL — file goes directly to Supabase Storage
 * 3. POST /api/upload/validate — server-side content validation
 *
 * If validation fails, the file is deleted server-side and the error is returned.
 */
export async function uploadFileSecure(params: UploadParams): Promise<UploadResult> {
  const { file, bucket, category, onProgress } = params

  // --- Phase 1: Prepare ---
  onProgress?.(5)

  const prepareRes = await fetch('/api/upload/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      bucket,
      category,
    }),
  })

  if (!prepareRes.ok) {
    const data = await prepareRes.json().catch(() => ({}))
    return { error: data.message ?? 'Failed to prepare upload. Please try again.' }
  }

  const { signedUrl, path, token } = await prepareRes.json()

  // --- Phase 2: Upload to signed URL ---
  onProgress?.(10)

  try {
    const uploadResult = await uploadToSignedUrl(signedUrl, token, file, onProgress)
    if (!uploadResult.ok) {
      return { error: 'Upload failed. Please check your connection and try again.' }
    }
  } catch {
    return { error: 'Upload failed. Please check your connection and try again.' }
  }

  onProgress?.(80)

  // --- Phase 3: Validate ---
  const validateRes = await fetch('/api/upload/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path, category }),
  })

  if (!validateRes.ok) {
    const data = await validateRes.json().catch(() => ({}))
    return { error: data.message ?? 'File validation failed.' }
  }

  onProgress?.(100)
  return { path }
}

/**
 * Upload file to Supabase's signed upload URL.
 *
 * Uses the Supabase Storage upload endpoint format:
 * PUT {signedUrl} with the file as FormData.
 */
async function uploadToSignedUrl(
  signedUrl: string,
  _token: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ ok: boolean }> {
  // If we have XMLHttpRequest (browser) and need progress, use it
  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', signedUrl)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          // Map upload progress to 10-80% of total
          const pct = Math.round(10 + (e.loaded / e.total) * 70)
          onProgress(pct)
        }
      })

      xhr.addEventListener('load', () => {
        resolve({ ok: xhr.status >= 200 && xhr.status < 300 })
      })

      xhr.addEventListener('error', () => {
        resolve({ ok: false })
      })

      // Supabase signed upload URL expects the file directly with content-type
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  // Fallback: simple fetch (no progress)
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })

  return { ok: res.ok }
}
