ALTER TABLE public.commitments
  ADD COLUMN IF NOT EXISTS reminder_sent_1h boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_commitments_reminder_pending
  ON public.commitments (scheduled_at)
  WHERE reminder_sent_1h = false;