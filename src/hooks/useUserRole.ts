import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'premium' | 'free' | 'trial';

interface UserRoleData {
  role: AppRole;
  expires_at: string | null;
}

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isTrial, setIsTrial] = useState(false);

  useEffect(() => {
    if (!user) {
      console.log('[useUserRole] Nenhum usuário autenticado');
      setRole(null);
      setIsAdmin(false);
      setIsPremium(false);
      setIsTrial(false);
      setLoading(false);
      return;
    }

    console.log('[useUserRole] Usuário autenticado:', user.id, user.email);
    fetchUserRole();
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;

    setLoading(true);
    console.log('[useUserRole] Buscando role para usuário:', user.id, user.email);
    
    try {
      // Buscar role via RPC para priorizar corretamente e evitar RLS inconsistências
      const { data: rpcRole, error } = await supabase.rpc('get_user_role', { _user_id: user.id });

      if (error) {
        console.error('[useUserRole] Erro ao buscar role via RPC:', error);
        throw error;
      }

      const userRole = (rpcRole as AppRole) || 'free';

      console.log('[useUserRole] ✅ Role determinada:', {
        userId: user.id,
        email: user.email,
        role: userRole,
        isAdmin: userRole === 'admin',
        isPremium: userRole === 'premium' || userRole === 'admin',
        isTrial: userRole === 'trial'
      });

      setRole(userRole);
      setIsAdmin(userRole === 'admin');
      setIsPremium(userRole === 'premium' || userRole === 'admin');
      setIsTrial(userRole === 'trial');
    } catch (error) {
      console.error('[useUserRole] ❌ Erro ao buscar role, definindo como free:', error);
      setRole('free');
      setIsAdmin(false);
      setIsPremium(false);
      setIsTrial(false);
    } finally {
      setLoading(false);
    }
  };

  return { 
    role, 
    isAdmin, 
    isPremium, 
    isTrial,
    loading, 
    refetch: fetchUserRole 
  };
}
