import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceRoleClient } from '@/lib/supabase/auth-helpers';
import { apiLimiter, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/presentations/[token]
 *
 * Public endpoint — no auth required. Uses service role client to bypass RLS.
 * The access_token in the URL acts as the credential.
 *
 * Headers:
 *   X-Presentation-Password: string (for password-protected presentations)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    // Fetch presentation by access_token
    const { data: presentation, error: presErr } = await supabase
      .from('presentations')
      .select('id, name, type, password, is_active, expires_at, allow_feedback, casting_call_id, casting_calls(title)')
      .eq('access_token', token)
      .single();

    if (presErr || !presentation) {
      return NextResponse.json({ error: 'Presentation not found' }, { status: 404 });
    }

    // Check active status
    if (!presentation.is_active) {
      return NextResponse.json({ error: 'This presentation is no longer available' }, { status: 404 });
    }

    // Check expiry
    if (presentation.expires_at && new Date(presentation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This presentation has expired' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castingTitle = (presentation.casting_calls as any)?.title ?? 'Casting';

    // Password check
    if (presentation.password) {
      const providedPassword = request.headers.get('X-Presentation-Password');
      if (!providedPassword) {
        return NextResponse.json({
          requiresPassword: true,
          presentation: { name: presentation.name, castingTitle },
        });
      }
      if (providedPassword !== presentation.password) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
      }
    }

    // Fetch talent data based on presentation type
    interface TalentData {
      id: string;
      applicationId: string;
      displayName: string;
      bio: string | null;
      city: string | null;
      state: string | null;
      age: number | null;
      gender: string | null;
      headshot: string | null;
      roleName: string | null;
    }

    let talents: TalentData[] = [];

    if (presentation.type === 'custom') {
      // Custom: presentation_items → applications → profiles + media
      const { data: items } = await supabase
        .from('presentation_items')
        .select('application_id, sort_order')
        .eq('presentation_id', presentation.id)
        .order('sort_order', { ascending: true });

      if (items && items.length > 0) {
        const appIds = items.map((i) => i.application_id);

        const { data: applications } = await supabase
          .from('applications')
          .select('id, user_id, casting_roles(name), profiles!user_id(display_name, first_name, last_name, bio, city, state, date_of_birth, gender)')
          .in('id', appIds);

        if (applications) {
          // Fetch headshots for all talent
          const userIds = applications.map((a) => a.user_id);
          const { data: photos } = await supabase
            .from('media')
            .select('user_id, storage_path')
            .in('user_id', userIds)
            .eq('type', 'photo')
            .eq('is_primary', true);

          const photoMap: Record<string, string> = {};
          for (const p of photos ?? []) {
            if (p.storage_path) {
              const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(p.storage_path);
              if (urlData?.publicUrl) photoMap[p.user_id] = urlData.publicUrl;
            }
          }

          // Build talents in presentation_items sort order
          const appMap = new Map(applications.map((a) => [a.id, a]));
          talents = items.map((item) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const app = appMap.get(item.application_id) as any;
            if (!app) return null;
            const profile = Array.isArray(app.profiles) ? app.profiles[0] : app.profiles;
            const role = Array.isArray(app.casting_roles) ? app.casting_roles[0] : app.casting_roles;
            const name = profile?.display_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Unknown';
            const dob = profile?.date_of_birth;
            let age: number | null = null;
            if (dob) {
              const birth = new Date(dob);
              const now = new Date();
              age = now.getFullYear() - birth.getFullYear();
              const m = now.getMonth() - birth.getMonth();
              if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
            }
            return {
              id: app.user_id,
              applicationId: app.id,
              displayName: name,
              bio: profile?.bio ?? null,
              city: profile?.city ?? null,
              state: profile?.state ?? null,
              age,
              gender: profile?.gender ?? null,
              headshot: photoMap[app.user_id] ?? null,
              roleName: role?.name ?? null,
            };
          }).filter(Boolean) as TalentData[];
        }
      }
    } else {
      // Live: presentation_sessions → sessions (return session info only for now)
      const { data: pressSessions } = await supabase
        .from('presentation_sessions')
        .select('session_id, sort_order, sessions(name)')
        .eq('presentation_id', presentation.id)
        .order('sort_order', { ascending: true });

      // For live presentations, return session names (talent comes from session groups, future feature)
      return NextResponse.json({
        presentation: { name: presentation.name, castingTitle, type: presentation.type, allowFeedback: presentation.allow_feedback },
        sessions: (pressSessions ?? []).map((s) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: (s.sessions as any)?.name ?? 'Session',
        })),
        talents: [],
      });
    }

    return NextResponse.json({
      presentation: { name: presentation.name, castingTitle, type: presentation.type, allowFeedback: presentation.allow_feedback },
      talents,
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/presentations/[token]
 *
 * Submit feedback for a talent in a presentation.
 * Uses service role client — no auth required, token acts as credential.
 *
 * Body: { applicationId, rating?, comment?, viewerName? }
 * Headers: X-Presentation-Password (for password-protected presentations)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateResult = apiLimiter.check(ip);
    if (!rateResult.success) return rateLimitResponse(rateResult.retryAfter);

    const supabase = createServiceRoleClient();

    // Validate presentation
    const { data: presentation } = await supabase
      .from('presentations')
      .select('id, password, is_active, expires_at, allow_feedback')
      .eq('access_token', token)
      .single();

    if (!presentation) {
      return NextResponse.json({ error: 'Presentation not found' }, { status: 404 });
    }
    if (!presentation.is_active) {
      return NextResponse.json({ error: 'Presentation is no longer available' }, { status: 404 });
    }
    if (presentation.expires_at && new Date(presentation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Presentation has expired' }, { status: 404 });
    }
    if (!presentation.allow_feedback) {
      return NextResponse.json({ error: 'Feedback is not enabled for this presentation' }, { status: 403 });
    }

    // Password check
    if (presentation.password) {
      const providedPassword = request.headers.get('X-Presentation-Password');
      if (!providedPassword || providedPassword !== presentation.password) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
      }
    }

    // Parse body
    const body = await request.json();
    const { applicationId, rating, comment, viewerName } = body as {
      applicationId: string;
      rating?: number;
      comment?: string;
      viewerName?: string;
    };

    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
    }

    // Validate rating range
    if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    // Verify applicationId belongs to this presentation
    const { data: item } = await supabase
      .from('presentation_items')
      .select('id')
      .eq('presentation_id', presentation.id)
      .eq('application_id', applicationId)
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Talent not found in this presentation' }, { status: 404 });
    }

    // Insert feedback
    const { data: feedback, error: insertErr } = await supabase
      .from('presentation_feedback')
      .insert({
        presentation_id: presentation.id,
        application_id: applicationId,
        viewer_name: viewerName?.trim() || null,
        rating: rating ?? null,
        comment: comment?.trim() || null,
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ id: feedback?.id }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
