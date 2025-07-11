import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionList } from "../TransactionList";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { AIReportsChat } from "../AIReportsChat";
import { FutureFeatures } from "../FutureFeatures";
import { Transaction } from "@/hooks/useTransactions";
import { 
  DollarSign, 
  TrendingUp, 
  User,
  Tags,
  BarChart,
  Bot
} from "lucide-react";

interface DashboardTabsProps {
  transactions: Transaction[];
  categories: any[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onRefresh: () => void;
}

export function DashboardTabs({ 
  transactions, 
  categories, 
  onDelete, 
  onEdit, 
  onRefresh 
}: DashboardTabsProps) {
  return (
    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList className="grid w-full grid-cols-7 bg-muted/30">
        <TabsTrigger value="dashboard" className="flex items-center space-x-2">
          <DollarSign className="h-4 w-4" />
          <span>Dashboard</span>
        </TabsTrigger>
        <TabsTrigger value="transactions" className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4" />
          <span>Transações</span>
        </TabsTrigger>
        <TabsTrigger value="categories" className="flex items-center space-x-2">
          <Tags className="h-4 w-4" />
          <span>Categorias</span>
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex items-center space-x-2">
          <BarChart className="h-4 w-4" />
          <span>Relatórios</span>
        </TabsTrigger>
        <TabsTrigger value="ai-chat" className="flex items-center space-x-2">
          <Bot className="h-4 w-4" />
          <span>IA Reports</span>
        </TabsTrigger>
        <TabsTrigger value="future" className="flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>Novidades</span>
        </TabsTrigger>
        <TabsTrigger value="profile" className="flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>Perfil</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="space-y-6">
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
      </TabsContent>

      <TabsContent value="transactions">
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
      </TabsContent>

      <TabsContent value="categories">
        <CategoryManager 
          categories={categories} 
          onRefresh={onRefresh}
        />
      </TabsContent>

      <TabsContent value="reports">
        <ReportsPage />
      </TabsContent>

      <TabsContent value="ai-chat">
        <AIReportsChat />
      </TabsContent>

      <TabsContent value="future">
        <FutureFeatures />
      </TabsContent>

      <TabsContent value="profile">
        <ProfileSettings />
      </TabsContent>
    </Tabs>
  );
}