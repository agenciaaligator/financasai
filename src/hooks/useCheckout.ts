import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useCheckout = () => {
  const [loading, setLoading] = useState(false);

  const createCheckoutSession = async (priceId: string) => {
    setLoading(true);
    try {
      toast({
        title: "Redirecionando para checkout...",
        description: "Aguarde enquanto preparamos seu pagamento",
      });

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        // Open checkout in new tab
        window.open(data.url, '_blank');
        
        toast({
          title: "Checkout aberto!",
          description: "Complete o pagamento na nova aba",
        });
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Erro ao criar checkout",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { createCheckoutSession, loading };
};
