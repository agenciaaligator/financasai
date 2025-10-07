import { useState, useEffect } from 'react';
import { useSubscription } from './useSubscription';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UsageStats {
  transactions: number;
  categories: number;
}

export function useFeatureLimits() {
  const { user } = useAuth();
  const { planLimits, loading: planLoading } = useSubscription();
  const [currentUsage, setCurrentUsage] = useState<UsageStats>({ transactions: 0, categories: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    fetchUsage();
  }, [user]);

  const fetchUsage = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [transactionsResult, categoriesResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        supabase
          .from('categories')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
      ]);

      setCurrentUsage({
        transactions: transactionsResult.count || 0,
        categories: categoriesResult.count || 0
      });
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canCreateTransaction = () => {
    if (!planLimits) return { allowed: false, reason: 'Carregando plano...' };
    if (planLimits.maxTransactions === null) return { allowed: true };
    
    const remaining = planLimits.maxTransactions - currentUsage.transactions;
    
    if (remaining <= 0) {
      return { 
        allowed: false, 
        reason: `Você atingiu o limite de ${planLimits.maxTransactions} transações do seu plano.`,
        current: currentUsage.transactions,
        limit: planLimits.maxTransactions
      };
    }
    
    return { 
      allowed: true, 
      remaining,
      current: currentUsage.transactions,
      limit: planLimits.maxTransactions
    };
  };

  const canCreateCategory = () => {
    if (!planLimits) return { allowed: false, reason: 'Carregando plano...' };
    if (planLimits.maxCategories === null) return { allowed: true };
    
    const remaining = planLimits.maxCategories - currentUsage.categories;
    
    if (remaining <= 0) {
      return { 
        allowed: false, 
        reason: `Você atingiu o limite de ${planLimits.maxCategories} categorias do seu plano.`,
        current: currentUsage.categories,
        limit: planLimits.maxCategories
      };
    }
    
    return { 
      allowed: true, 
      remaining,
      current: currentUsage.categories,
      limit: planLimits.maxCategories
    };
  };

  const getTransactionProgress = () => {
    if (!planLimits?.maxTransactions) return null;
    const percentage = (currentUsage.transactions / planLimits.maxTransactions) * 100;
    return {
      current: currentUsage.transactions,
      limit: planLimits.maxTransactions,
      percentage: Math.min(percentage, 100),
      isNearLimit: percentage >= 80
    };
  };

  const getCategoryProgress = () => {
    if (!planLimits?.maxCategories) return null;
    const percentage = (currentUsage.categories / planLimits.maxCategories) * 100;
    return {
      current: currentUsage.categories,
      limit: planLimits.maxCategories,
      percentage: Math.min(percentage, 100),
      isNearLimit: percentage >= 80
    };
  };

  return {
    canCreateTransaction,
    canCreateCategory,
    currentUsage,
    planLimits,
    isLoading: isLoading || planLoading,
    refetchUsage: fetchUsage,
    getTransactionProgress,
    getCategoryProgress
  };
}
