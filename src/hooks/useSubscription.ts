import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useSubscriptionStatus } from './useSubscriptionStatus';
import { getPlanLimits, PlanLimits } from '@/lib/featureFlags';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  role: string;
  max_transactions: number | null;
  max_categories: number | null;
  has_whatsapp: boolean;
  has_ai_reports: boolean;
  has_google_calendar: boolean;
  has_bank_integration: boolean;
  has_multi_user: boolean;
  has_priority_support: boolean;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  subscription_plans: SubscriptionPlan;
}

export function useSubscription() {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Usar o novo hook centralizado para status do Stripe
  const { status: stripeStatus, loading: stripeLoading, refreshStatus } = useSubscriptionStatus(session);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setPlanLimits(null);
      setLoading(false);
      return;
    }

    fetchSubscription();
  }, [user]);

  const fetchSubscription = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      setSubscription(data as UserSubscription | null);
      
      const limits = await getPlanLimits(user.id);
      setPlanLimits(limits);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  // Função de refresh unificada que atualiza tanto Stripe quanto Supabase
  const refetch = async () => {
    await Promise.all([
      fetchSubscription(),
      refreshStatus()
    ]);
  };

  const getPlanDisplayName = async () => {
    if (!user) return 'Gratuito';

    console.log('[useSubscription] Determinando nome do plano para:', user.email);

    // Verificar se é admin
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id });
    console.log('[useSubscription] Role retornada:', roleData);
    
    if (roleData === 'admin') {
      console.log('[useSubscription] ✅ Usuário é admin');
      return 'Admin (Acesso Total)';
    }

    // Priorizar user_subscriptions como fonte da verdade
    if (subscription && subscription.status === 'active') {
      const billingCycle = subscription.billing_cycle;
      
      if (billingCycle === 'trial') {
        // Calcular dias restantes
        const endDate = new Date(subscription.current_period_end);
        const today = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        console.log('[useSubscription] ✅ Trial ativo:', daysRemaining, 'dias restantes');
        return `Trial (${daysRemaining} dias restantes)`;
      }
      
      if (billingCycle === 'monthly') {
        console.log('[useSubscription] ✅ Premium Mensal');
        return 'Premium Mensal';
      }
      
      if (billingCycle === 'yearly') {
        console.log('[useSubscription] ✅ Premium Anual');
        return 'Premium Anual';
      }
    }

    // Verificar se tem plano herdado da organização
    const { data: orgPlanData } = await supabase
      .rpc('get_org_plan_limits', { _user_id: user.id })
      .maybeSingle();

    if (orgPlanData && orgPlanData.is_inherited) {
      console.log('[useSubscription] ✅ Plano herdado da organização de:', orgPlanData.owner_email);
      const displayName = orgPlanData.plan_name === 'trial' 
        ? 'Trial Premium' 
        : orgPlanData.plan_name === 'premium'
        ? 'Premium'
        : orgPlanData.plan_name;
      return `${displayName} (herdado)`;
    }

    console.log('[useSubscription] ✅ Plano Gratuito');
    return 'Gratuito';
  };

  const [planDisplayName, setPlanDisplayName] = useState<string>('Carregando...');
  const [loadingPlanName, setLoadingPlanName] = useState(true);

  useEffect(() => {
    if (user) {
      setLoadingPlanName(true);
      getPlanDisplayName().then(name => {
        setPlanDisplayName(name);
        setLoadingPlanName(false);
      });
    } else {
      setPlanDisplayName('Gratuito');
      setLoadingPlanName(false);
    }
  }, [user, subscription]);

  return { 
    subscription, 
    planLimits: planLimits, 
    loading: loading || loadingPlanName || stripeLoading,
    refetch,
    isFreePlan: !subscription || subscription.subscription_plans?.name === 'free',
    isPremium: subscription?.subscription_plans?.name === 'premium',
    isTrial: subscription?.subscription_plans?.name === 'trial',
    planName: planDisplayName,
    billingCycle: subscription?.billing_cycle || 'monthly',
    // Expor status do Stripe para componentes que precisam
    stripeStatus,
  };
}
