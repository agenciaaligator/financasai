import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionList } from "../TransactionList";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { AIReportsChat } from "../AIReportsChat";
import { FutureFeatures } from "../FutureFeatures";
import { Transaction } from "@/hooks/useTransactions";

interface DashboardContentProps {
  currentTab: string;
  transactions: Transaction[];
  categories: any[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onRefresh: () => void;
}

export function DashboardContent({ 
  currentTab,
  transactions, 
  categories, 
  onDelete, 
  onEdit, 
  onRefresh 
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
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>Todas as Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList 
            transactions={transactions} 
            onDelete={onDelete}
            onEdit={onEdit}
          />
        </CardContent>
      </Card>
    );
  }

  if (currentTab === "categories") {
    return (
      <CategoryManager 
        categories={categories} 
        onRefresh={onRefresh}
      />
    );
  }

  if (currentTab === "reports") {
    return <ReportsPage />;
  }

  if (currentTab === "ai-chat") {
    return <AIReportsChat />;
  }

  if (currentTab === "future") {
    return <FutureFeatures />;
  }

  if (currentTab === "profile") {
    return <ProfileSettings />;
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