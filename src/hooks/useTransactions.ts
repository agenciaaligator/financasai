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

    // FETCH TRANSAÇÕES SEM PROFILES (evitar problemas de RLS)
    let query = supabase
      .from('transactions')
      .select(`
        *,
        categories (
          name,
          color
        )
      `)
      .order('date', { ascending: false });

    // Se o usuário pode ver apenas os próprios dados
    if (!canViewOthers) {
      // Membro sem view_others: vê APENAS as próprias
      query = query.eq('user_id', user.id);
    } else if (organization_id) {
      // Owner/Admin ou membro com view_others: vê org + próprias sem org
      query = query.or(`organization_id.eq.${organization_id},and(user_id.eq.${user.id},organization_id.is.null)`);
    } else {
      // Fallback: apenas as próprias
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao carregar transações:', error);
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    // BUSCAR PROFILES SEPARADAMENTE (respeitando RLS)
    const userIds = [...new Set((data || []).map((t: any) => t.user_id))];
    let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      if (profilesData) {
        profilesData.forEach((p: any) => {
          profilesMap[p.user_id] = {
            full_name: p.full_name,
            email: p.email
          };
        });
      }
    }

    // MERGE PROFILES COM TRANSAÇÕES
    const transactionsWithProfiles = (data || []).map((t: any) => ({
      ...t,
      profiles: profilesMap[t.user_id] || null
    }));

    console.log('✅ Transações carregadas:', {
      total: transactionsWithProfiles.length,
      canViewOthers,
      organization_id,
      sampleTransaction: transactionsWithProfiles[0] ? {
        id: transactionsWithProfiles[0].id,
        user_id: transactionsWithProfiles[0].user_id,
        organization_id: transactionsWithProfiles[0].organization_id,
        title: transactionsWithProfiles[0].title,
        profiles: transactionsWithProfiles[0].profiles
      } : null
    });
    
    setTransactions(transactionsWithProfiles);
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

    // Inserir transação SEM profiles
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        ...transaction,
        user_id: user.id,
        organization_id: organization_id || null
      }])
      .select(`
        *,
        categories (
          name,
          color
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

    // BUSCAR PROFILE SEPARADAMENTE
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single();

    const mappedData = {
      ...data,
      profiles: profileData || null
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