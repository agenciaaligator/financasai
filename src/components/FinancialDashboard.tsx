import { useState } from "react";
import { TransactionForm } from "./TransactionForm";
import { EditTransactionModal } from "./EditTransactionModal";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { Transaction } from "@/hooks/useTransactions";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { BalanceAlert } from "./dashboard/BalanceAlert";
import { SummaryCards } from "./dashboard/SummaryCards";
import { AddTransactionButton } from "./dashboard/AddTransactionButton";
import { DashboardTabs } from "./dashboard/DashboardTabs";
import { WhatsAppInfo } from "./dashboard/WhatsAppInfo";

export function FinancialDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { user, signOut } = useAuth();
  const { transactions, categories, loading, balance, totalIncome, totalExpenses, addTransaction, deleteTransaction, refetch } = useTransactions();

  console.log('Dashboard renderizado - user:', user?.email);
  console.log('Categories carregadas:', categories?.length);
  console.log('Transactions carregadas:', transactions?.length);

  const handleAddTransaction = async (transaction: any) => {
    const result = await addTransaction(transaction);
    if (!result?.error) {
      setShowForm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isNegative = balance < 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <div className="container mx-auto px-6 py-8">
        <DashboardHeader 
          userEmail={user?.email} 
          onSignOut={signOut} 
        />

        <BalanceAlert isNegative={isNegative} />

        <SummaryCards 
          balance={balance}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
        />

        <AddTransactionButton 
          showForm={showForm}
          onToggle={() => setShowForm(!showForm)}
        />

        {showForm && (
          <div className="mb-6">
            <TransactionForm 
              onSubmit={handleAddTransaction}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <DashboardTabs 
          transactions={transactions}
          categories={categories}
          onDelete={deleteTransaction}
          onEdit={setEditingTransaction}
          onRefresh={refetch}
        />

        <WhatsAppInfo />

        <EditTransactionModal
          transaction={editingTransaction}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onUpdate={refetch}
        />
      </div>
    </div>
  );
}