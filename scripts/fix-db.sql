-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function: auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'talent'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS casting_calls_updated_at ON public.casting_calls;
CREATE TRIGGER casting_calls_updated_at
  BEFORE UPDATE ON public.casting_calls
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS applications_updated_at ON public.applications;
CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role() = 'admin');

-- PROFILE ETHNICITIES
CREATE POLICY "Users manage own ethnicities"
  ON public.profile_ethnicities FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Admins read all ethnicities"
  ON public.profile_ethnicities FOR SELECT
  USING (public.get_user_role() = 'admin');

-- PROFILE SKILLS
CREATE POLICY "Users manage own skills"
  ON public.profile_skills FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Admins read all skills"
  ON public.profile_skills FOR SELECT
  USING (public.get_user_role() = 'admin');

-- PROFILE LANGUAGES
CREATE POLICY "Users manage own languages"
  ON public.profile_languages FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Admins read all languages"
  ON public.profile_languages FOR SELECT
  USING (public.get_user_role() = 'admin');

-- PROFILE UNIONS
CREATE POLICY "Users manage own unions"
  ON public.profile_unions FOR ALL
  USING (profile_id = auth.uid());

CREATE POLICY "Admins read all unions"
  ON public.profile_unions FOR SELECT
  USING (public.get_user_role() = 'admin');

-- MEDIA
CREATE POLICY "Users manage own media"
  ON public.media FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all media"
  ON public.media FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Public can view primary photos"
  ON public.media FOR SELECT
  USING (is_primary = true);

-- CASTING CALLS
CREATE POLICY "Public can view open public castings"
  ON public.casting_calls FOR SELECT
  USING (status = 'open' AND visibility = 'public');

CREATE POLICY "Authenticated can view registered castings"
  ON public.casting_calls FOR SELECT
  USING (status = 'open' AND visibility IN ('public', 'registered_only') AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage all castings"
  ON public.casting_calls FOR ALL
  USING (public.get_user_role() = 'admin');

-- CASTING ROLES
CREATE POLICY "Public can view casting roles for visible castings"
  ON public.casting_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.casting_calls cc
      WHERE cc.id = casting_call_id
        AND cc.status = 'open'
        AND cc.visibility = 'public'
    )
  );

CREATE POLICY "Admins manage all casting roles"
  ON public.casting_roles FOR ALL
  USING (public.get_user_role() = 'admin');

-- CASTING ATTACHMENTS
CREATE POLICY "Admins manage casting attachments"
  ON public.casting_attachments FOR ALL
  USING (public.get_user_role() = 'admin');

-- APPLICATIONS
CREATE POLICY "Users can apply"
  ON public.applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own applications"
  ON public.applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage all applications"
  ON public.applications FOR ALL
  USING (public.get_user_role() = 'admin');

-- CASTING INVITATIONS
CREATE POLICY "Users can view own invitations"
  ON public.casting_invitations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can respond to invitations"
  ON public.casting_invitations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage all invitations"
  ON public.casting_invitations FOR ALL
  USING (public.get_user_role() = 'admin');

-- USER TAGS
CREATE POLICY "Admins manage all tags"
  ON public.user_tags FOR ALL
  USING (public.get_user_role() = 'admin');

-- SAVED SEARCHES
CREATE POLICY "Admins manage own saved searches"
  ON public.saved_searches FOR ALL
  USING (admin_user_id = auth.uid() AND public.get_user_role() = 'admin');

-- AUDIT LOG
CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "System inserts audit log"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- REF TABLES (public read)
CREATE POLICY "Anyone can read ref_ethnicities"
  ON public.ref_ethnicities FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read ref_languages"
  ON public.ref_languages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read ref_skills"
  ON public.ref_skills FOR SELECT
  USING (true);

-- REP TABLES (Phase 2 prep)
CREATE POLICY "Reps manage own casting comments"
  ON public.rep_casting_comments FOR ALL
  USING (author_id = auth.uid());

CREATE POLICY "Admins read all casting comments"
  ON public.rep_casting_comments FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Reps manage own talent reviews"
  ON public.rep_talent_reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.casting_rep_assignments cra
      WHERE cra.id = assignment_id
        AND cra.rep_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all talent reviews"
  ON public.rep_talent_reviews FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins manage rep assignments"
  ON public.casting_rep_assignments FOR ALL
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Reps view own assignments"
  ON public.casting_rep_assignments FOR SELECT
  USING (rep_user_id = auth.uid());

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_ethnicities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_unions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_ethnicities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_casting_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_talent_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_rep_assignments ENABLE ROW LEVEL SECURITY;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
