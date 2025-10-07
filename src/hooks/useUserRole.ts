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
      setRole(null);
      setIsAdmin(false);
      setIsPremium(false);
      setIsTrial(false);
      setLoading(false);
      return;
    }

    fetchUserRole();
  }, [user]);

  const fetchUserRole = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Buscar TODAS as roles do usuário
      const { data: allRoles, error } = await supabase
        .from('user_roles')
        .select('role, expires_at')
        .eq('user_id', user.id);

      if (error) throw error;

      console.info('Roles encontradas para o usuário:', allRoles);

      // Se não tiver nenhuma role, usar free como fallback
      if (!allRoles || allRoles.length === 0) {
        console.info('Nenhuma role encontrada, usando free como fallback');
        setRole('free');
        setIsAdmin(false);
        setIsPremium(false);
        setIsTrial(false);
        return;
      }

      // Filtrar roles não expiradas
      const activeRoles = allRoles.filter(r => {
        if (!r.expires_at) return true; // Se não tem expiração, está ativa
        return new Date(r.expires_at) > new Date();
      });

      console.info('Roles ativas:', activeRoles);

      // Prioridade: admin > premium > trial > free
      const rolePriority: Record<AppRole, number> = {
        admin: 4,
        premium: 3,
        trial: 2,
        free: 1
      };

      // Pegar a role de maior prioridade
      const highestRole = activeRoles.reduce((highest, current) => {
        const currentPriority = rolePriority[current.role as AppRole] || 0;
        const highestPriority = rolePriority[highest.role as AppRole] || 0;
        return currentPriority > highestPriority ? current : highest;
      }, activeRoles[0]);

      const userRole = (highestRole?.role as AppRole) || 'free';
      
      console.info('Role final selecionada:', userRole);

      setRole(userRole);
      setIsAdmin(userRole === 'admin');
      setIsPremium(userRole === 'premium' || userRole === 'admin');
      setIsTrial(userRole === 'trial');
    } catch (error) {
      console.error('Error fetching user role:', error);
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
