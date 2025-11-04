import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RecurringTransaction {
  id: string;
  user_id: string;
  organization_id?: string;
  title: string;
  description?: string;
  amount: number;
  type: "income" | "expense";
  category_id?: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  day_of_month?: number;
  day_of_week?: number;
  interval_days?: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  reminders: number[];
  created_at: string;
  updated_at: string;
}

export interface RecurringInstance {
  id: string;
  recurring_transaction_id: string;
  due_date: string;
  amount: number;
  status: "scheduled" | "paid" | "postponed" | "paused";
  paid_at?: string;
  transaction_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export function useRecurringTransactions() {
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [instances, setInstances] = useState<RecurringInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRecurringTransactions = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from("recurring_transactions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRecurringTransactions((data as RecurringTransaction[]) || []);
    } catch (error: any) {
      console.error("Error fetching recurring transactions:", error);
      toast({
        title: "Erro ao carregar contas fixas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from("recurring_instances")
        .select("*")
        .order("due_date", { ascending: true });

      if (error) throw error;
      setInstances((data as RecurringInstance[]) || []);
    } catch (error: any) {
      console.error("Error fetching instances:", error);
    }
  };

  const addRecurringTransaction = async (transaction: Omit<RecurringTransaction, "id" | "created_at" | "updated_at" | "user_id">) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("recurring_transactions")
        .insert([{ ...transaction, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Conta fixa criada!",
        description: "A conta fixa foi criada com sucesso.",
      });

      await fetchRecurringTransactions();
      return data;
    } catch (error: any) {
      console.error("Error creating recurring transaction:", error);
      toast({
        title: "Erro ao criar conta fixa",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateRecurringTransaction = async (id: string, updates: Partial<RecurringTransaction>) => {
    try {
      const { error } = await supabase
        .from("recurring_transactions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Conta fixa atualizada!",
        description: "As alterações foram salvas com sucesso.",
      });

      await fetchRecurringTransactions();
    } catch (error: any) {
      console.error("Error updating recurring transaction:", error);
      toast({
        title: "Erro ao atualizar conta fixa",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteRecurringTransaction = async (id: string) => {
    try {
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Conta fixa removida",
        description: "A conta fixa foi removida com sucesso.",
      });

      await fetchRecurringTransactions();
    } catch (error: any) {
      console.error("Error deleting recurring transaction:", error);
      toast({
        title: "Erro ao remover conta fixa",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const payInstance = async (instanceId: string, transactionId?: string) => {
    try {
      const { error } = await supabase
        .from("recurring_instances")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          transaction_id: transactionId,
        })
        .eq("id", instanceId);

      if (error) throw error;

      toast({
        title: "Baixa registrada!",
        description: "O pagamento foi registrado com sucesso.",
      });

      await fetchInstances();
    } catch (error: any) {
      console.error("Error paying instance:", error);
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const postponeInstance = async (instanceId: string, newDueDate: string, notes?: string) => {
    try {
      const { error } = await supabase
        .from("recurring_instances")
        .update({
          status: "postponed",
          due_date: newDueDate,
          notes: notes,
        })
        .eq("id", instanceId);

      if (error) throw error;

      toast({
        title: "Conta adiada",
        description: "A data de vencimento foi atualizada.",
      });

      await fetchInstances();
    } catch (error: any) {
      console.error("Error postponing instance:", error);
      toast({
        title: "Erro ao adiar conta",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const pauseRecurring = async (id: string) => {
    await updateRecurringTransaction(id, { is_active: false });
  };

  const resumeRecurring = async (id: string) => {
    await updateRecurringTransaction(id, { is_active: true });
  };

  useEffect(() => {
    fetchRecurringTransactions();
    fetchInstances();

    const recurringChannel = supabase
      .channel("recurring_transactions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_transactions" },
        () => {
          fetchRecurringTransactions();
        }
      )
      .subscribe();

    const instancesChannel = supabase
      .channel("recurring_instances_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recurring_instances" },
        () => {
          fetchInstances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(recurringChannel);
      supabase.removeChannel(instancesChannel);
    };
  }, []);

  return {
    recurringTransactions,
    instances,
    loading,
    addRecurringTransaction,
    updateRecurringTransaction,
    deleteRecurringTransaction,
    payInstance,
    postponeInstance,
    pauseRecurring,
    resumeRecurring,
    refetch: fetchRecurringTransactions,
  };
}
