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

  // Scroll para o topo quando mudar de tab (DEVE estar antes de qualquer early return)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  console.log('[FinancialDashboard] org_id:', organization_id, 'role:', role, 'isOwner:', isOwner);
  console.log('[FinancialDashboard] isAdmin:', isAdmin, 'roleLoading:', roleLoading);
  console.log('Dashboard renderizado - user:', user?.email);
  console.log('Categories carregadas:', categories?.length);
  console.log('Transactions carregadas:', transactions?.length);
  console.log('Current tab:', currentTab);
  console.log('Is mobile:', isMobile);
  console.log('Mobile menu open:', mobileMenuOpen);

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
    console.log('Tab mudando de', currentTab, 'para', tab);
    setCurrentTab(tab);
    if (isMobile) {
      console.log('Mobile: fechando menu após mudança de tab');
      setMobileMenuOpen(false);
    }
  };

  if (isMobile) {
    return (
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
                    onClick={() => {
                      console.log('Botão menu clicado - abrindo sheet');
                      setMobileMenuOpen(true);
                    }}
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
                  {currentTab === "dashboard" && "Dashboard Financeiro"}
                  {currentTab === "transactions" && "Transações"}
                  {currentTab === "categories" && "Categorias"}
                  {currentTab === "reports" && "Relatórios"}
                  {currentTab === "ai-chat" && "IA Reports"}
                  {currentTab === "agenda" && "Agenda"}
                  {currentTab === "recurring" && "Contas Fixas"}
                  {currentTab === "whatsapp" && "WhatsApp"}
                  {currentTab === "team" && "Equipe"}
                  {currentTab === "future" && "Novidades"}
                  {currentTab === "profile" && "Perfil"}
                  {currentTab === "admin" && "Painel Administrativo"}
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
                    {currentTab === "dashboard" && "Dashboard Financeiro"}
                    {currentTab === "transactions" && "Transações"}
                    {currentTab === "categories" && "Categorias"}
                    {currentTab === "reports" && "Relatórios"}
                    {currentTab === "ai-chat" && "IA Reports"}
                    {currentTab === "agenda" && "Agenda"}
                    {currentTab === "recurring" && "Contas Fixas"}
                    {currentTab === "whatsapp" && "WhatsApp"}
                    {currentTab === "team" && "Equipe"}
                    {currentTab === "future" && "Novidades"}
                    {currentTab === "profile" && "Perfil"}
                    {currentTab === "admin" && "Painel Administrativo"}
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