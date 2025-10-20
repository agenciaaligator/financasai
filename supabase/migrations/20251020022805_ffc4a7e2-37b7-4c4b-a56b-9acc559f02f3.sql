-- Criar função RPC para backfill de transações
CREATE OR REPLACE FUNCTION backfill_transactions_org(p_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Atualizar transações com organization_id null
  -- para membros da organização especificada
  UPDATE public.transactions t
  SET organization_id = m.organization_id
  FROM public.organization_members m
  WHERE t.user_id = m.user_id
    AND t.organization_id IS NULL
    AND m.organization_id = p_organization_id;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RETURN affected_count;
END;
$$;