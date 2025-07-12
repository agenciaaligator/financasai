import { useState } from "react";
import { TransactionForm } from "./TransactionForm";
import { EditTransactionModal } from "./EditTransactionModal";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { Transaction } from "@/hooks/useTransactions";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { BalanceAlert } from "./dashboard/BalanceAlert";
import { SummaryCards } from "./dashboard/SummaryCards";
import { DashboardContent } from "./dashboard/DashboardContent";
import { WhatsAppInfo } from "./dashboard/WhatsAppInfo";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function FinancialDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [currentTab, setCurrentTab] = useState("dashboard");
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-muted/30 to-secondary/20">
        <AppSidebar 
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          showForm={showForm}
          onToggleForm={() => setShowForm(!showForm)}
        />
        
        <main className="flex-1 flex flex-col">
          {/* Header com trigger do sidebar */}
          <header className="border-b border-sidebar-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="h-8 w-8" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">
                    {currentTab === "dashboard" && "Dashboard"}
                    {currentTab === "transactions" && "Transações"}
                    {currentTab === "categories" && "Categorias"}
                    {currentTab === "reports" && "Relatórios"}
                    {currentTab === "ai-chat" && "IA Reports"}
                    {currentTab === "future" && "Novidades"}
                    {currentTab === "profile" && "Perfil"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Olá, {user?.email}
                  </p>
                </div>
              </div>
              <DashboardHeader 
                userEmail={user?.email} 
                onSignOut={signOut}
                minimal={true}
              />
            </div>
          </header>

          {/* Conteúdo principal */}
          <div className="flex-1 p-6 overflow-auto">
            <BalanceAlert isNegative={isNegative} />

            <SummaryCards 
              balance={balance}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
            />

            {showForm && (
              <div className="mb-6">
                <TransactionForm 
                  onSubmit={handleAddTransaction}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            )}

            <DashboardContent 
              currentTab={currentTab}
              transactions={transactions}
              categories={categories}
              onDelete={deleteTransaction}
              onEdit={setEditingTransaction}
              onRefresh={refetch}
            />

            <WhatsAppInfo />
          </div>
        </main>

        <EditTransactionModal
          transaction={editingTransaction}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onUpdate={refetch}
        />
      </div>
    </SidebarProvider>
  );
}