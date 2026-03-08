import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, requireAdminUser } from '@/lib/supabase/auth-helpers';
import { apiLimiter, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const authResult = await requireAdminUser(supabase);
  if (authResult.response) return authResult.response;
  const adminUserId = authResult.data!.userId;

  const rateResult = apiLimiter.check(adminUserId);
  if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

  const body = await request.json();
  const { action, userIds } = body as { action: string; userIds: string[] };

  if (!action || !Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: 'Missing action or userIds' }, { status: 400 });
  }

  if (userIds.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 users per batch' }, { status: 400 });
  }

  switch (action) {
    case 'bulk_tag': {
      const { tagName } = body as { tagName: string };
      if (!tagName?.trim()) return NextResponse.json({ error: 'Missing tagName' }, { status: 400 });

      const rows = userIds.map((uid) => ({
        user_id: uid,
        tag_name: tagName.trim(),
        created_by: adminUserId,
      }));
      const { error } = await supabase.from('user_tags').upsert(rows, { onConflict: 'user_id,tag_name', ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, count: userIds.length });
    }

    case 'bulk_invite': {
      const { castingCallId, message } = body as { castingCallId: string; message?: string };
      if (!castingCallId) return NextResponse.json({ error: 'Missing castingCallId' }, { status: 400 });

      const rows = userIds.map((uid) => ({
        casting_call_id: castingCallId,
        user_id: uid,
        message: message || null,
        status: 'pending' as const,
        invited_by: adminUserId,
      }));
      const { error } = await supabase.from('casting_invitations').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, count: userIds.length });
    }

    case 'export_csv': {
      const { data: users } = await supabase
        .from('profiles')
        .select('first_name, last_name, display_name, city, state, talent_type, experience_level, profile_completion_pct, status, created_at')
        .in('id', userIds);

      if (!users || users.length === 0) {
        return NextResponse.json({ error: 'No users found' }, { status: 404 });
      }

      const headers = ['Name', 'Display Name', 'City', 'State', 'Talent Type', 'Experience', 'Profile %', 'Status', 'Registered'];
      const csvRows = [headers.join(',')];

      for (const u of users) {
        const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
        const talentTypes = (u.talent_type ?? []).join('; ');
        const row = [
          `"${name}"`,
          `"${u.display_name ?? ''}"`,
          `"${u.city ?? ''}"`,
          `"${u.state ?? ''}"`,
          `"${talentTypes}"`,
          u.experience_level ?? '',
          u.profile_completion_pct ?? 0,
          u.status,
          u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
        ];
        csvRows.push(row.join(','));
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="talent_export_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
