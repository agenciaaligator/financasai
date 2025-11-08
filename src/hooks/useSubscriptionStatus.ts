import { useState, useEffect, useRef, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionStatus {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
}

interface UseSubscriptionStatusReturn {
  status: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refreshStatus: () => Promise<void>;
}

const DEFAULT_STATUS: SubscriptionStatus = {
  subscribed: false,
  product_id: null,
  subscription_end: null,
  stripe_subscription_id: null,
  stripe_customer_id: null,
};

export function useSubscriptionStatus(session: Session | null): UseSubscriptionStatusReturn {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs para debounce e cooldown
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const isCheckingRef = useRef<boolean>(false);

  // Função para verificar status da assinatura
  const checkSubscriptionStatus = useCallback(async (sessionData: Session | null, force = false) => {
    // Verificar se já está checando
    if (isCheckingRef.current && !force) {
      console.log('[useSubscriptionStatus] Check already in progress, skipping');
      return;
    }

    // Verificar cooldown (mínimo 2s entre checks, a menos que seja forçado)
    const now = Date.now();
    if (!force && (now - lastCheckTimeRef.current < 2000)) {
      console.log('[useSubscriptionStatus] Cooldown active, skipping check');
      return;
    }

    // Validar sessão
    if (!sessionData?.user || !sessionData.access_token) {
      console.log('[useSubscriptionStatus] No valid session, setting default status');
      setStatus(DEFAULT_STATUS);
      setError(null);
      return;
    }

    try {
      isCheckingRef.current = true;
      setLoading(true);
      setError(null);
      lastCheckTimeRef.current = Date.now();

      console.log('[useSubscriptionStatus] Checking subscription status');

      const { data, error: invokeError } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${sessionData.access_token}`
        }
      });

      if (invokeError) {
        throw invokeError;
      }

      console.log('[useSubscriptionStatus] Subscription status received:', data);
      
      setStatus(data || DEFAULT_STATUS);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check subscription';
      console.error('[useSubscriptionStatus] Error:', errorMessage);
      setError(errorMessage);
      setStatus(DEFAULT_STATUS);
    } finally {
      setLoading(false);
      isCheckingRef.current = false;
    }
  }, []);

  // Função pública para refresh manual (com force=true)
  const refreshStatus = useCallback(async () => {
    console.log('[useSubscriptionStatus] Manual refresh triggered');
    await checkSubscriptionStatus(session, true);
  }, [session, checkSubscriptionStatus]);

  // Effect para verificar status quando a sessão muda
  useEffect(() => {
    // Limpar timeout anterior
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    // Se não há sessão, limpar status
    if (!session?.user) {
      setStatus(DEFAULT_STATUS);
      setError(null);
      return;
    }

    // Debounce de 500ms para evitar chamadas múltiplas
    checkTimeoutRef.current = setTimeout(() => {
      checkSubscriptionStatus(session);
    }, 500);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [session, checkSubscriptionStatus]);

  return {
    status,
    loading,
    error,
    refreshStatus,
  };
}
