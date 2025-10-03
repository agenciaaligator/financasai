import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { AIReportsChat } from "../AIReportsChat";
import { FutureFeatures } from "../FutureFeatures";
import { BalanceAlert } from "./BalanceAlert";
import { SummaryCards } from "./SummaryCards";
import { DashboardTabs } from "./DashboardTabs";
import { Transaction } from "@/hooks/useTransactions";
import { TransactionList } from "../TransactionList";

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
      <DashboardTabs 
        transactions={transactions}
        categories={categories}
        onDelete={onDelete}
        onEdit={onEdit}
        onRefresh={onRefresh}
      />
    );
  }

  if (currentTab === "categories") {
    return (
      <CategoryManager 
        categories={categories} 
        onRefresh={onRefresh} 
        showForm={false}
        setShowForm={() => {}}
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

  // Fallback para dashboard
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