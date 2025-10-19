import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationPermissions } from './useOrganizationPermissions';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  description?: string;
  date: string;
  category_id?: string;
  source: 'manual' | 'whatsapp';
  created_at: string;
  user_id: string;
  organization_id?: string;
  categories?: {
    name: string;
    color: string;
  };
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { organization_id, canViewOthers, loading: permsLoading } = useOrganizationPermissions();

  const fetchTransactions = async () => {
    if (!user) return;
    
    setLoading(true);

    let query = supabase
      .from('transactions')
      .select(`
        *,
        categories (
          name,
          color
        ),
        profiles!transactions_user_id_fkey (
          full_name,
          email
        )
      `)
      .order('date', { ascending: false });

    // Se o usuário pode ver apenas os próprios dados
    if (!canViewOthers) {
      query = query.eq('user_id', user.id);
    } else if (organization_id) {
      // Se pode ver outros, busca por organization_id
      query = query.eq('organization_id', organization_id);
    } else {
      // Fallback: apenas os próprios
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setTransactions((data as any[])?.map(t => ({
        ...t,
        profiles: Array.isArray(t.profiles) && t.profiles.length > 0 ? t.profiles[0] : null
      })) || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setCategories((data as Category[]) || []);
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'categories' | 'user_id' | 'organization_id' | 'profiles'>) => {
    if (!user) return;

    // Fetch organization_id
    const { data: orgData } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        ...transaction,
        user_id: user.id,
        organization_id: orgData?.organization_id || null
      }])
      .select(`
        *,
        categories (
          name,
          color
        ),
        profiles!transactions_user_id_fkey (
          full_name,
          email
        )
      `)
      .single();

    if (error) {
      toast({
        title: "Erro ao adicionar transação",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }

    const mappedData = {
      ...data,
      profiles: Array.isArray((data as any).profiles) && (data as any).profiles.length > 0 
        ? (data as any).profiles[0] 
        : null
    } as Transaction;
    
    setTransactions(prev => [mappedData, ...prev]);
    toast({
      title: "Transação adicionada!",
      description: `${transaction.type === 'income' ? 'Receita' : 'Despesa'} de R$ ${transaction.amount.toFixed(2)} adicionada.`,
    });

    return { error: null };
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro ao excluir transação",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
    toast({
      title: "Transação excluída",
      description: "A transação foi removida com sucesso.",
    });
  };

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    if (permsLoading) {
      return;
    }

    fetchTransactions();
    fetchCategories();
  }, [user, organization_id, canViewOthers, permsLoading]);

  const balance = transactions.reduce((acc, transaction) => {
    return transaction.type === 'income' 
      ? acc + transaction.amount 
      : acc - transaction.amount;
  }, 0);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const refetch = async () => {
    await fetchTransactions();
    await fetchCategories();
  };

  return {
    transactions,
    categories,
    loading,
    balance,
    totalIncome,
    totalExpenses,
    addTransaction,
    deleteTransaction,
    refetch
  };
}