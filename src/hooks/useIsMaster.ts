import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useIsMaster() {
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function checkMaster() {
      if (!user) {
        setIsMaster(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_master_user', { 
          _user_id: user.id 
        });
        
        if (error) throw error;
        setIsMaster(!!data);
      } catch (err) {
        console.error('Erro ao verificar master:', err);
        setIsMaster(false);
      } finally {
        setLoading(false);
      }
    }

    checkMaster();
  }, [user]);

  return { isMaster, loading };
}
