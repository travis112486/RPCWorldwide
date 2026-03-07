/**
 * Client-side helper to check upload rate limit before uploading files.
 * Returns `{ allowed: true }` or throws an error with a user-friendly message.
 */
export async function checkUploadRateLimit(): Promise<void> {
  const res = await fetch('/api/upload/check', { method: 'POST' })

  if (res.status === 429) {
    const { retryAfter } = await res.json()
    throw new Error(`Upload limit reached. Please try again in ${retryAfter} seconds.`)
  }

  if (res.status === 401) {
    throw new Error('You must be signed in to upload files.')
  }

  if (!res.ok) {
    throw new Error('Upload check failed. Please try again.')
  }
}
