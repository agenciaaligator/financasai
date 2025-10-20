import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useOrganizationOwnership(organizationId?: string | null) {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function checkOwnership() {
      if (!user) {
        setIsOwner(false);
        setLoading(false);
        return;
      }

      // Se não tem organizationId definido, retornar false (sem fallback)
      if (!organizationId) {
        setIsOwner(false);
        setLoading(false);
        return;
      }

      try {
        // Verifica se é owner APENAS da organização ativa
        const { data, error } = await supabase
          .from('organizations')
          .select('id')
          .eq('id', organizationId)
          .eq('owner_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar ownership da organização:', error);
          setIsOwner(false);
        } else {
          setIsOwner(!!data);
        }
      } catch (err) {
        console.error('Erro ao verificar ownership:', err);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    }

    checkOwnership();
  }, [user, organizationId]);

  return { isOwner, loading };
}
