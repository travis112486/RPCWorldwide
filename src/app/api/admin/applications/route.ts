import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServerSupabaseClient, requireAdminUser } from '@/lib/supabase/auth-helpers';
import { apiLimiter, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const castingId = req.nextUrl.searchParams.get('casting_id');
  if (!castingId) {
    return NextResponse.json({ error: 'Missing casting_id' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const authResult = await requireAdminUser(supabase);
  if (authResult.response) return authResult.response;

  const rateResult = apiLimiter.check(authResult.data!.userId);
  if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

  // Fetch casting details, roles, and applications in parallel
  const [castingRes, rolesRes, appRes] = await Promise.all([
    supabase
      .from('casting_calls')
      .select('title, project_type, description, compensation_type, compensation_details, location_text, is_remote, start_date, end_date, deadline, visibility, status')
      .eq('id', castingId)
      .single(),
    supabase
      .from('casting_roles')
      .select('id, name, description, sort_order, role_type, union_requirement, pay_rate')
      .eq('casting_call_id', castingId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('applications')
      .select('*, profiles!user_id(display_name, first_name, last_name, city, state, talent_type, experience_level, height_cm, weight_kg, gender, bio), casting_roles(id, name)')
      .eq('casting_call_id', castingId)
      .order('applied_at', { ascending: false }),
  ]);

  if (appRes.error) {
    Sentry.captureException(new Error(appRes.error.message));
    return NextResponse.json({ error: appRes.error.message, detail: appRes.error }, { status: 500 });
  }

  // Batch-load primary headshots for all applicants
  const avatars: Record<string, string> = {};
  const userIds = [...new Set((appRes.data ?? []).map((a) => a.user_id))];

  if (userIds.length > 0) {
    const { data: mediaData } = await supabase
      .from('media')
      .select('user_id, storage_path')
      .in('user_id', userIds)
      .eq('type', 'photo')
      .eq('is_primary', true);

    mediaData?.forEach((row) => {
      if (row.storage_path) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(row.storage_path);
        if (urlData?.publicUrl) avatars[row.user_id] = urlData.publicUrl;
      }
    });
  }

  return NextResponse.json({
    casting: castingRes.data,
    roles: rolesRes.data ?? [],
    applications: appRes.data ?? [],
    avatars,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const authResult = await requireAdminUser(supabase);
  if (authResult.response) return authResult.response;

  const rateResult = apiLimiter.check(authResult.data!.userId);
  if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

  const body = await request.json();
  const { id, admin_notes, shortlist_rank } = body as {
    id: string;
    admin_notes?: string;
    shortlist_rank?: number | null;
  };

  if (!id) {
    return NextResponse.json({ error: 'Missing application id' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (admin_notes !== undefined) updates.admin_notes = admin_notes;
  if (shortlist_rank !== undefined) updates.shortlist_rank = shortlist_rank;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('applications')
    .update(updates)
    .eq('id', id);

  if (error) {
    Sentry.captureException(new Error(error.message));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
