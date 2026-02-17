import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionList } from "../TransactionList";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { TransactionFilters, TransactionFiltersState } from "../TransactionFilters";
import { Transaction } from "@/hooks/useTransactions";
import { ErrorBoundary } from "../ErrorBoundary";
import { 
  DollarSign, 
  TrendingUp, 
  User,
  Tags,
  BarChart,
  Shield,
} from "lucide-react";
import { AdminPanel } from "../admin/AdminPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  isWithinInterval,
  parseISO
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = 'America/Sao_Paulo';

interface DashboardTabsProps {
  transactions: Transaction[];
  categories: any[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onRefresh: () => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export function DashboardTabs({ 
  transactions, 
  categories, 
  onDelete, 
  onEdit, 
  onRefresh,
  currentTab,
  onTabChange
}: DashboardTabsProps) {
  const { isAdmin, role, loading } = useUserRole();
  
  const [filters, setFilters] = useState<TransactionFiltersState>({
    period: 'all',
    type: 'all',
    searchText: '',
  });

  const filteredTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    
    return transactions.filter(transaction => {
      if (filters.period !== 'all') {
        const transactionDate = toZonedTime(parseISO(transaction.date), TIMEZONE);
        let startDate: Date;
        let endDate: Date;

        switch (filters.period) {
          case 'today':
            startDate = startOfDay(now);
            endDate = endOfDay(now);
            break;
          case 'week':
            startDate = startOfWeek(now, { weekStartsOn: 0 });
            endDate = endOfWeek(now, { weekStartsOn: 0 });
            break;
          case 'month':
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            break;
          case 'last_month': {
            const lastMonth = subMonths(now, 1);
            startDate = startOfMonth(lastMonth);
            endDate = endOfMonth(lastMonth);
            break;
          }
          default:
            return true;
        }

        if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
          return false;
        }
      }

      if (filters.type !== 'all' && transaction.type !== filters.type) {
        return false;
      }

      if (filters.searchText.trim() !== '') {
        const searchLower = filters.searchText.toLowerCase();
        const titleMatch = transaction.title.toLowerCase().includes(searchLower);
        const descMatch = transaction.description?.toLowerCase().includes(searchLower);
        if (!titleMatch && !descMatch) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filters]);

  return (
    <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
      <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'} bg-muted/30`}>
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
        <TabsTrigger value="profile" className="flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>Perfil</span>
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="admin" className="flex items-center space-x-2 bg-primary/10">
            <Shield className="h-4 w-4" />
            <span>Admin</span>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="dashboard" className="space-y-6">
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
              transactions={transactions.slice(0, 5)} 
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="transactions" className="space-y-4">
        <TransactionFilters 
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
        />
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Todas as Transações</span>
              <span className="text-sm font-normal text-muted-foreground">
                Mostrando {filteredTransactions.length} de {transactions.length} transações
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionList 
              transactions={filteredTransactions} 
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
          showForm={false}
          setShowForm={() => {}}
        />
      </TabsContent>

      <TabsContent value="reports">
        <ReportsPage />
      </TabsContent>

      <TabsContent value="profile">
        <ProfileSettings />
      </TabsContent>

      {isAdmin && (
        <TabsContent value="admin">
          <AdminPanel />
        </TabsContent>
      )}
    </Tabs>
  );
}
