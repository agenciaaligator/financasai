import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionList } from "../TransactionList";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { AIReportsChat } from "../AIReportsChat";
import { FutureFeatures } from "../FutureFeatures";
import { TransactionFilters, TransactionFiltersState } from "../TransactionFilters";
import { Transaction } from "@/hooks/useTransactions";
import { 
  DollarSign, 
  TrendingUp, 
  User,
  Tags,
  BarChart,
  Bot,
  Shield
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
  startOfYear, 
  endOfYear,
  subDays,
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
}

export function DashboardTabs({ 
  transactions, 
  categories, 
  onDelete, 
  onEdit, 
  onRefresh 
}: DashboardTabsProps) {
  const { isAdmin, role, loading } = useUserRole();
  
  console.log('[DashboardTabs] Role status:', { isAdmin, role, loading });
  const [filters, setFilters] = useState<TransactionFiltersState>({
    period: 'all',
    customDateRange: { start: null, end: null },
    type: 'all',
    categories: [],
    source: 'all',
    searchText: ''
  });

  const filteredTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    
    return transactions.filter(transaction => {
      // Filtro de período
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
          case '30days':
            startDate = startOfDay(subDays(now, 30));
            endDate = endOfDay(now);
            break;
          case '90days':
            startDate = startOfDay(subDays(now, 90));
            endDate = endOfDay(now);
            break;
          case 'year':
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            break;
          case 'custom':
            if (filters.customDateRange.start && filters.customDateRange.end) {
              startDate = startOfDay(toZonedTime(filters.customDateRange.start, TIMEZONE));
              endDate = endOfDay(toZonedTime(filters.customDateRange.end, TIMEZONE));
            } else {
              return true;
            }
            break;
          default:
            return true;
        }

        if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
          return false;
        }
      }

      // Filtro de tipo
      if (filters.type !== 'all' && transaction.type !== filters.type) {
        return false;
      }

      // Filtro de categoria
      if (filters.categories.length > 0 && transaction.category_id) {
        if (!filters.categories.includes(transaction.category_id)) {
          return false;
        }
      }

      // Filtro de fonte
      if (filters.source !== 'all' && transaction.source !== filters.source) {
        return false;
      }

      // Filtro de texto
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
    <Tabs defaultValue="dashboard" className="w-full">
      <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-8' : 'grid-cols-7'} bg-muted/30`}>
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
        {isAdmin && (
          <TabsTrigger value="admin" className="flex items-center space-x-2 bg-primary/10">
            <Shield className="h-4 w-4" />
            <span>Admin</span>
          </TabsTrigger>
        )}
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

      <TabsContent value="ai-chat">
        <AIReportsChat />
      </TabsContent>

      <TabsContent value="future">
        <FutureFeatures />
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