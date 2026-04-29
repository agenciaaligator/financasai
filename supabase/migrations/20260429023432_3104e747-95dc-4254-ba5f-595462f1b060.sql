DELETE FROM public.commitments c
USING public.commitments c2
WHERE c.google_event_id IS NOT NULL
  AND c.user_id = c2.user_id
  AND c.google_event_id = c2.google_event_id
  AND c.created_at > c2.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS commitments_user_google_event_unique
  ON public.commitments (user_id, google_event_id)
  WHERE google_event_id IS NOT NULL;