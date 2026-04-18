import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useCheckout = () => {
  const [loading, setLoading] = useState(false);

  const createCheckoutSession = async (priceId: string, cycle?: string) => {
    setLoading(true);
    try {
      console.log('[CHECKOUT] Creating session with priceId:', priceId, 'cycle:', cycle);
      
      toast({
        title: "🔄 Redirecionando para checkout...",
        description: "Aguarde enquanto preparamos seu pagamento",
      });

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId,
          cycle: cycle || 'monthly'
        },
      });

      if (error) {
        console.error('[CHECKOUT] Error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('URL de checkout não retornada');
      }

      console.log('[CHECKOUT] Redirecting to Stripe:', data.url);

      // Redirecionar na mesma aba (onboarding linear, funciona em mobile)
      window.location.href = data.url;
      
    } catch (error) {
      console.error('[CHECKOUT] Error:', error);
      toast({
        title: "❌ Erro ao criar checkout",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { createCheckoutSession, loading };
};