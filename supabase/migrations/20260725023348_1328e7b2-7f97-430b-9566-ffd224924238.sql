DROP INDEX IF EXISTS public.commitments_user_google_event_unique;
DROP INDEX IF EXISTS public.commitments_user_google_event_uniq;
CREATE UNIQUE INDEX commitments_user_google_event_unique ON public.commitments (user_id, google_event_id);