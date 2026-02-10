import { useState, useEffect } from "react";
import { TransactionForm } from "./TransactionForm";
import { EditTransactionModal } from "./EditTransactionModal";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganizationOwnership } from "@/hooks/useOrganizationOwnership";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { Transaction } from "@/hooks/useTransactions";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { BalanceAlert } from "./dashboard/BalanceAlert";
import { SummaryCards } from "./dashboard/SummaryCards";
import { DashboardContent } from "./dashboard/DashboardContent";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";

export function FinancialDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { organization_id, role } = useOrganizationPermissions();
  const isOwner = role === 'owner'; // Derivar isOwner da role ativa
  const { transactions, categories, loading, balance, totalIncome, totalExpenses, addTransaction, deleteTransaction, refetch } = useTransactions();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const tabTitleMap: Record<string, string> = {
    dashboard: t('dashboard.title', 'Dashboard Financeiro'),
    transactions: t('dashboard.transactions', 'Transações'),
    categories: t('dashboard.categories', 'Categorias'),
    reports: t('dashboard.reports', 'Relatórios'),
    recurring: t('dashboard.recurring', 'Contas Fixas'),
    whatsapp: t('dashboard.whatsapp', 'WhatsApp'),
    future: t('dashboard.future', 'Novidades'),
    profile: t('dashboard.profile', 'Perfil'),
    admin: t('dashboard.admin', 'Painel Administrativo'),
  };

  // Scroll para o topo quando mudar de tab ou abrir formulário (DEVE estar antes de qualquer early return)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  // Scroll para o topo quando abrir o formulário de nova transação
  useEffect(() => {
    if (showForm) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showForm]);


  const handleAddTransaction = async (transaction: any) => {
    const result = await addTransaction(transaction);
    if (!result?.error) {
      setShowForm(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isNegative = balance < 0;

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  if (isMobile) {
    return (
      <SidebarProvider>
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
        {/* Header Mobile */}
        <header className="border-b border-sidebar-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => setMobileMenuOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0 bg-sidebar">
                  <AppSidebar 
                    currentTab={currentTab}
                    onTabChange={handleTabChange}
                    showForm={showForm}
                    onToggleForm={() => {
                      setShowForm(!showForm);
                      setMobileMenuOpen(false);
                    }}
                    isOwner={isOwner}
                    isAdmin={isAdmin}
                  />
                </SheetContent>
              </Sheet>
              <div>
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {tabTitleMap[currentTab] || currentTab}
                </h1>
              </div>
            </div>
            <DashboardHeader 
              userEmail={user?.email} 
              onSignOut={signOut}
              minimal={true}
            />
          </div>
        </header>

        {/* Conteúdo Mobile */}
        <div className="p-4 overflow-auto" data-scroll-container>
          {showForm && (
            <div className="mb-4">
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
              balance={balance}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              isNegative={isNegative}
              showTransactionForm={showForm}
              onToggleTransactionForm={() => setShowForm(!showForm)}
            />
        </div>

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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-muted/30 to-secondary/20">
        <AppSidebar 
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          showForm={showForm}
          onToggleForm={() => setShowForm(!showForm)}
          isOwner={isOwner}
          isAdmin={isAdmin}
        />
        
        <main className="flex-1 flex flex-col">
          {/* Header Desktop */}
          <header className="border-b border-sidebar-border bg-background/80 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="h-8 w-8" />
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    {tabTitleMap[currentTab] || currentTab}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.hello', 'Olá')}, {user?.email}
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

          {/* Conteúdo Desktop */}
          <div className="flex-1 p-6 overflow-auto" data-scroll-container>
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
              balance={balance}
              totalIncome={totalIncome}
              totalExpenses={totalExpenses}
              isNegative={isNegative}
              showTransactionForm={showForm}
              onToggleTransactionForm={() => setShowForm(!showForm)}
            />
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