import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOrganizationPermissions } from './useOrganizationPermissions';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Transaction } from './useTransactions';
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

export interface MonthlyGoal {
  id: string;
  user_id: string;
  organization_id: string | null;
  category_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal: MonthlyGoal;
  categoryName: string;
  categoryColor: string;
  spent: number;
  percentage: number;
}

export function useMonthlyGoals(transactions: Transaction[], categories: any[]) {
  const { user } = useAuth();
  const { organization_id } = useOrganizationPermissions();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('monthly_goals' as any)
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setGoals((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching goals:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const addGoal = useCallback(async (categoryId: string, amount: number) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('monthly_goals' as any)
        .upsert({
          user_id: user.id,
          organization_id: organization_id || null,
          category_id: categoryId,
          amount,
        } as any, { onConflict: 'user_id,category_id' });

      if (error) throw error;
      await fetchGoals();
      return { success: true };
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      return { error: err };
    }
  }, [user, organization_id, fetchGoals, toast]);

  const deleteGoal = useCallback(async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('monthly_goals' as any)
        .delete()
        .eq('id', goalId);

      if (error) throw error;
      await fetchGoals();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }, [fetchGoals, toast]);

  const goalsWithProgress: GoalProgress[] = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const currentMonthExpenses = transactions.filter(t => {
      if (t.type !== 'expense') return false;
      try {
        const d = toZonedTime(parseISO(t.date), TIMEZONE);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });

    return goals.map(goal => {
      const cat = categories.find((c: any) => c.id === goal.category_id);
      const spent = currentMonthExpenses
        .filter(t => t.category_id === goal.category_id)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const percentage = goal.amount > 0 ? Math.round((spent / goal.amount) * 100) : 0;

      return {
        goal,
        categoryName: cat?.name || 'Sem categoria',
        categoryColor: cat?.color || '#6B7280',
        spent,
        percentage,
      };
    });
  }, [goals, transactions, categories]);

  return { goals, goalsWithProgress, loading, addGoal, deleteGoal, refetch: fetchGoals };
}
