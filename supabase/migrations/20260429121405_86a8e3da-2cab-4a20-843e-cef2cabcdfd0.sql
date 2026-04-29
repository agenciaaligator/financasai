WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, title, scheduled_at
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.commitments
  WHERE google_event_id IS NULL
)
DELETE FROM public.commitments c
USING ranked_duplicates d
WHERE c.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS commitments_unique_manual_slot_idx
ON public.commitments (user_id, title, scheduled_at)
WHERE google_event_id IS NULL;