import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useOrganizationOwnership() {
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

      try {
        // Verifica se usuário é owner de alguma organização
        const { data, error } = await supabase
          .from('organizations')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar ownership:', error);
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
  }, [user]);

  return { isOwner, loading };
}
