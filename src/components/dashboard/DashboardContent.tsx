import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionList } from "../TransactionList";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { AIReportsChat } from "../AIReportsChat";
import { FutureFeatures } from "../FutureFeatures";
import { BalanceAlert } from "./BalanceAlert";
import { SummaryCards } from "./SummaryCards";
import { Transaction } from "@/hooks/useTransactions";

interface DashboardContentProps {
  currentTab: string;
  transactions: Transaction[];
  categories: any[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onRefresh: () => void;
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  isNegative: boolean;
}

export function DashboardContent({ 
  currentTab,
  transactions, 
  categories, 
  onDelete, 
  onEdit, 
  onRefresh,
  balance,
  totalIncome,
  totalExpenses,
  isNegative
}: DashboardContentProps) {
  
  // Debug logs para identificar problemas
  console.log('DashboardContent renderizado:', {
    currentTab,
    transactionsCount: transactions?.length,
    categoriesCount: categories?.length
  });

  if (currentTab === "dashboard") {
    return (
      <div className="space-y-6">
        <BalanceAlert isNegative={isNegative} />
        
        <SummaryCards 
          balance={balance}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>Gráfico Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialChart transactions={transactions} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>Transações Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionList 
                transactions={transactions.slice(0, 10)} 
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentTab === "transactions") {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Todas as Transações</h2>
          <p className="text-muted-foreground">Gerencie todas as suas transações financeiras</p>
        </div>
        <Card className="bg-gradient-card shadow-card border-0">
          <CardContent className="p-6">
            <TransactionList 
              transactions={transactions} 
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentTab === "categories") {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Categorias</h2>
          <p className="text-muted-foreground">Organize suas transações por categorias</p>
        </div>
        <CategoryManager 
          categories={categories} 
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  if (currentTab === "reports") {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Relatórios</h2>
          <p className="text-muted-foreground">Analise suas finanças com relatórios detalhados</p>
        </div>
        <ReportsPage />
      </div>
    );
  }

  if (currentTab === "ai-chat") {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">IA Reports</h2>
          <p className="text-muted-foreground">Converse com a IA sobre suas finanças</p>
        </div>
        <AIReportsChat />
      </div>
    );
  }

  if (currentTab === "future") {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Novidades</h2>
          <p className="text-muted-foreground">Descubra as próximas funcionalidades</p>
        </div>
        <FutureFeatures />
      </div>
    );
  }

  if (currentTab === "profile") {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Perfil</h2>
          <p className="text-muted-foreground">Gerencie suas configurações pessoais</p>
        </div>
        <ProfileSettings />
      </div>
    );
  }

  // Fallback: se nenhuma aba foi reconhecida, volta para o dashboard
  console.warn('Tab não reconhecida:', currentTab, 'voltando para dashboard');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Gráfico Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <FinancialChart transactions={transactions} />
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionList 
              transactions={transactions.slice(0, 10)} 
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}