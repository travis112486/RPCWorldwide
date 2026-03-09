/**
 * Shared audit logging utility.
 *
 * Inserts into the `audit_log` table via the caller's Supabase client.
 * Wraps all inserts in try/catch — audit failures never break admin actions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'user.suspend'
  | 'user.deactivate'
  | 'user.reactivate'
  | 'application.status_change'
  | 'casting.create'
  | 'casting.update'
  | 'tag.add'
  | 'tag.remove'
  | 'bulk.tag'
  | 'bulk.invite'

export type AuditEntityType = 'user' | 'application' | 'casting_call'

interface AuditParams {
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  /** Valid IP string or null. Empty strings are coerced to null (inet column). */
  ipAddress?: string | null
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/**
 * Insert an audit log entry. Resolves user_id from the current session.
 *
 * This function never throws — errors are logged to console.error so that
 * audit failures do not block the primary admin action.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  params: AuditParams,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Coerce empty/undefined ipAddress to null (inet type rejects empty strings)
    const ip = params.ipAddress || null

    const { error } = await supabase.from('audit_log').insert({
      user_id: user?.id ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: String(params.entityId),
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      ip_address: ip,
    })

    if (error) {
      console.error('[audit-log] Failed to insert audit entry:', error.message)
    }
  } catch (err) {
    console.error('[audit-log] Unexpected error:', err)
  }
}
