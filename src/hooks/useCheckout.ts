import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useCheckout = () => {
  const [loading, setLoading] = useState(false);

  const createCheckoutSession = async (priceId: string) => {
    setLoading(true);
    try {
      console.log('[CHECKOUT] Creating session with priceId:', priceId);
      
      // Validar cupom antes de criar checkout (se existir)
      const couponCode = sessionStorage.getItem('coupon_code');
      
      toast({
        title: "🔄 Redirecionando para checkout...",
        description: "Aguarde enquanto preparamos seu pagamento",
      });

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId,
          couponCode: couponCode || undefined
        },
      });

      if (error) {
        console.error('[CHECKOUT] Error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('URL de checkout não retornada');
      }

      console.log('[CHECKOUT] Session URL:', data.url);

      // Abrir checkout em nova aba
      const checkoutWindow = window.open(data.url, '_blank');
      
      if (!checkoutWindow) {
        toast({
          title: "⚠️ Pop-up bloqueado",
          description: "Permita pop-ups para este site e tente novamente",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "✅ Checkout aberto!",
        description: "Complete o pagamento na nova aba. Esta janela pode ficar aberta.",
        duration: 10000
      });

      // Limpar cupom após usar
      sessionStorage.removeItem('coupon_code');
      
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