-- Add rank column for shortlisted applicants
ALTER TABLE public.applications
  ADD COLUMN shortlist_rank integer;

COMMENT ON COLUMN public.applications.shortlist_rank
  IS 'Rank order for shortlisted applicants. Nullable — only meaningful when status = shortlisted.';

-- Partial index for efficient shortlist queries
CREATE INDEX idx_applications_shortlist_rank
  ON public.applications (casting_call_id, shortlist_rank)
  WHERE status = 'shortlisted' AND shortlist_rank IS NOT NULL;
