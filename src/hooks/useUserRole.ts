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
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, expires_at')
        .eq('user_id', user.id)
        .order('role', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const userRole = (data?.role as AppRole) || 'free';
      
      // Verificar se trial expirou (14 dias)
      if (userRole === 'trial' && data?.expires_at) {
        const expired = new Date(data.expires_at) < new Date();
        if (expired) {
          // Downgrade para free
          await supabase
            .from('user_roles')
            .update({ role: 'free' })
            .eq('user_id', user.id)
            .eq('role', 'trial');
          
          setRole('free');
          setIsAdmin(false);
          setIsPremium(false);
          setIsTrial(false);
          return;
        }
      }

      setRole(userRole);
      setIsAdmin(userRole === 'admin');
      setIsPremium(userRole === 'premium' || userRole === 'admin');
      setIsTrial(userRole === 'trial');
    } catch (error) {
      console.error('Error fetching user role:', error);
      setRole('free'); // Fallback para free
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
