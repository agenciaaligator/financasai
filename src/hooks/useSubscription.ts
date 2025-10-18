import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
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
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);

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

    // Verificar se tem cupom FULLACCESS
    const { data: couponData } = await supabase
      .from('user_coupons')
      .select('discount_coupons(type, is_active, expires_at)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (couponData?.discount_coupons) {
      const coupon = couponData.discount_coupons;
      const isActive = coupon.is_active && (!coupon.expires_at || new Date(coupon.expires_at) > new Date());
      if (coupon.type === 'full_access' && isActive) {
        console.log('[useSubscription] ✅ Usuário tem cupom FULLACCESS');
        return 'Acesso Total (Cupom)';
      }
    }

    // Verificar se tem plano herdado da organização
    const { data: orgPlanData } = await supabase
      .rpc('get_org_plan_limits', { _user_id: user.id })
      .maybeSingle();

    if (orgPlanData && orgPlanData.is_inherited) {
      console.log('[useSubscription] ✅ Plano herdado da organização');
      return `${orgPlanData.plan_name} (herdado)`;
    }

    const planName = subscription?.subscription_plans?.display_name || 'Gratuito';
    console.log('[useSubscription] ✅ Plano final:', planName);
    return planName;
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
    planLimits, 
    loading: loading || loadingPlanName, 
    refetch: fetchSubscription,
    isFreePlan: !subscription || subscription.subscription_plans?.name === 'free',
    isPremium: subscription?.subscription_plans?.name === 'premium',
    isTrial: subscription?.subscription_plans?.name === 'trial',
    planName: planDisplayName,
    billingCycle: subscription?.billing_cycle || 'monthly'
  };
}
