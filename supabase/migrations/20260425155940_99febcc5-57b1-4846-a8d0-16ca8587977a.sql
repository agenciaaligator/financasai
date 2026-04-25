DO $$
DECLARE
  v_uid uuid := '2efec051-aa64-4f31-8c1b-c22ac51d7d7b';
BEGIN
  DELETE FROM public.goal_alerts_sent WHERE user_id = v_uid;
  DELETE FROM public.monthly_goals WHERE user_id = v_uid;
  DELETE FROM public.recurring_instances
    WHERE recurring_transaction_id IN (
      SELECT id FROM public.recurring_transactions WHERE user_id = v_uid
    );
  DELETE FROM public.recurring_transactions WHERE user_id = v_uid;
  DELETE FROM public.transactions WHERE user_id = v_uid;
END $$;