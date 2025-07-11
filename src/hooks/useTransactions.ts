import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

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
  categories?: {
    name: string;
    color: string;
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

  const fetchTransactions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (
          name,
          color
        )
      `)
      .order('date', { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setTransactions((data as Transaction[]) || []);
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

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'categories'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        ...transaction,
        user_id: user.id
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

    setTransactions(prev => [data as Transaction, ...prev]);
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
    if (user) {
      fetchTransactions();
      fetchCategories();
    }
  }, [user]);

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