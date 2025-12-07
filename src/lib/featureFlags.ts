import { supabase } from '@/integrations/supabase/client';

export interface PlanLimits {
  maxTransactions: number | null;
  maxCategories: number | null;
  hasWhatsapp: boolean;
  hasAiReports: boolean;
  hasGoogleCalendar: boolean;
  hasBankIntegration: boolean;
  hasMultiUser: boolean;
  hasPrioritySupport: boolean;
}

/**
 * Busca os limites e features do plano ativo do usuário
 */
export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  // Verificar se o usuário tem role admin
  const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: userId });
  if (roleData === 'admin') {
    return {
      maxTransactions: null,
      maxCategories: null,
      hasWhatsapp: true,
      hasAiReports: true,
      hasGoogleCalendar: true,
      hasBankIntegration: true,
      hasMultiUser: true,
      hasPrioritySupport: true,
    };
  }

  // Check active subscription (coupons now managed via Stripe)
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_id, subscription_plans(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!subscription?.subscription_plans) {
    // Verificar se tem plano herdado da organização
    const { data: orgPlanData } = await supabase
      .rpc('get_org_plan_limits', { _user_id: userId })
      .maybeSingle();

    if (orgPlanData) {
      return {
        maxTransactions: orgPlanData.max_transactions,
        maxCategories: orgPlanData.max_categories,
        hasWhatsapp: orgPlanData.has_whatsapp,
        hasAiReports: orgPlanData.has_ai_reports,
        hasGoogleCalendar: orgPlanData.has_google_calendar,
        hasBankIntegration: orgPlanData.has_bank_integration,
        hasMultiUser: orgPlanData.has_multi_user,
        hasPrioritySupport: orgPlanData.has_priority_support
      };
    }

    // Retornar limites do plano free por padrão
    return {
      maxTransactions: 50,
      maxCategories: 10,
      hasWhatsapp: true,
      hasAiReports: false,
      hasGoogleCalendar: false,
      hasBankIntegration: false,
      hasMultiUser: false,
      hasPrioritySupport: false
    };
  }

  const plan = subscription.subscription_plans as any;
  return {
    maxTransactions: plan.max_transactions,
    maxCategories: plan.max_categories,
    hasWhatsapp: plan.has_whatsapp,
    hasAiReports: plan.has_ai_reports,
    hasGoogleCalendar: plan.has_google_calendar,
    hasBankIntegration: plan.has_bank_integration,
    hasMultiUser: plan.has_multi_user,
    hasPrioritySupport: plan.has_priority_support
  };
}

/**
 * Middleware de validação: verifica se usuário pode criar nova transação
 */
export async function canCreateTransaction(userId: string): Promise<{ 
  allowed: boolean; 
  reason?: string;
  currentCount?: number;
  limit?: number;
}> {
  const limits = await getPlanLimits(userId);
  
  if (limits.maxTransactions === null) {
    return { allowed: true }; // Sem limite (Premium ou Trial)
  }

  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count && count >= limits.maxTransactions) {
    return { 
      allowed: false, 
      reason: `Você atingiu o limite de ${limits.maxTransactions} transações do plano Gratuito. Faça upgrade para o Premium e tenha transações ilimitadas!`,
      currentCount: count,
      limit: limits.maxTransactions
    };
  }

  return { allowed: true, currentCount: count || 0, limit: limits.maxTransactions };
}

/**
 * Middleware de validação: verifica se usuário pode criar nova categoria
 */
export async function canCreateCategory(userId: string): Promise<{ 
  allowed: boolean; 
  reason?: string;
  currentCount?: number;
  limit?: number;
}> {
  const limits = await getPlanLimits(userId);
  
  if (limits.maxCategories === null) {
    return { allowed: true }; // Sem limite (Premium ou Trial)
  }

  const { count } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count && count >= limits.maxCategories) {
    return { 
      allowed: false, 
      reason: `Você atingiu o limite de ${limits.maxCategories} categorias do plano Gratuito. Faça upgrade para o Premium!`,
      currentCount: count,
      limit: limits.maxCategories
    };
  }

  return { allowed: true, currentCount: count || 0, limit: limits.maxCategories };
}

/**
 * Verifica se usuário tem acesso a uma feature específica
 */
export async function hasFeatureAccess(
  userId: string, 
  feature: keyof Omit<PlanLimits, 'maxTransactions' | 'maxCategories'>
): Promise<boolean> {
  const limits = await getPlanLimits(userId);
  return limits[feature];
}
