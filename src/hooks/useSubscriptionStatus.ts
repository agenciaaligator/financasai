import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionStatus {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
}

export const useSubscriptionStatus = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const checkSubscription = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`
        }
      });

      if (error) throw error;

      setStatus(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      // Check immediately on mount
      checkSubscription();

      // DESABILITADO: Polling a cada 60 segundos (economizar créditos Stripe)
      // const interval = setInterval(checkSubscription, 60000);
      // return () => clearInterval(interval);
    }
  }, [user]);

  return { status, loading, refetch: checkSubscription };
};
