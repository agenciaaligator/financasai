import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { AIReportsChat } from "../AIReportsChat";
import { FutureFeatures } from "../FutureFeatures";
import { AdminPanel } from "../admin/AdminPanel";
import { BalanceAlert } from "./BalanceAlert";
import { SummaryCards } from "./SummaryCards";
import { FilteredSummaryCards } from "./FilteredSummaryCards";
import { AddTransactionButton } from "./AddTransactionButton";
import { LimitWarning } from "./LimitWarning";
import { Transaction } from "@/hooks/useTransactions";
import { TransactionList } from "../TransactionList";
import { TransactionFilters, TransactionFiltersState } from "../TransactionFilters";
import { useSubscription } from "@/hooks/useSubscription";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
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
import { ErrorBoundary } from "../ErrorBoundary";
import { CommitmentsManager } from "../CommitmentsManager";
import { TeamManagement } from "../admin/TeamManagement";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

const TIMEZONE = 'America/Sao_Paulo';
const ITEMS_PER_PAGE = 10;

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
  showTransactionForm: boolean;
  onToggleTransactionForm: () => void;
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
  isNegative,
  showTransactionForm,
  onToggleTransactionForm
}: DashboardContentProps) {
  const { planName, planLimits } = useSubscription();
  const { getTransactionProgress, getCategoryProgress } = useFeatureLimits();
  const { canViewOthers } = useOrganizationPermissions();
  const { user } = useAuth();
  
  const [filters, setFilters] = useState<TransactionFiltersState>({
    period: 'all',
    customDateRange: { start: null, end: null },
    type: 'all',
    categories: [],
    source: 'all',
    searchText: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showOnlyMine, setShowOnlyMine] = useState(false);

  // Reset para página 1 quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    
    return transactions.filter(transaction => {
      // Filtro "Ver apenas minhas" se habilitado
      if (showOnlyMine && canViewOthers && user?.id && transaction.user_id !== user.id) {
        return false;
      }
      // Filtro de período
      if (filters.period !== 'all') {
        try {
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
        } catch (error) {
          console.warn('[DashboardContent] Data inválida na transação:', transaction.id, transaction.date);
          return true; // Incluir transações com data inválida
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
  }, [transactions, filters, showOnlyMine, canViewOthers, user]);
  
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
    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

    const hasActiveFilters = filters.period !== 'all' || 
                            filters.type !== 'all' || 
                            filters.categories.length > 0 || 
                            filters.source !== 'all' || 
                            filters.searchText.trim() !== '';

    const transactionProgress = getTransactionProgress();
    const categoryProgress = getCategoryProgress();

    return (
      <ErrorBoundary>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <AddTransactionButton 
              showForm={showTransactionForm}
              onToggle={onToggleTransactionForm}
            />
            
            {canViewOthers && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-only-mine"
                  checked={showOnlyMine}
                  onCheckedChange={setShowOnlyMine}
                />
                <Label htmlFor="show-only-mine" className="cursor-pointer">
                  Ver apenas minhas transações
                </Label>
              </div>
            )}
          </div>
          
          {/* Limit Warnings */}
          {planLimits && transactionProgress && transactionProgress.current !== null && transactionProgress.limit !== null && (
            <LimitWarning 
              type="transaction" 
              current={transactionProgress.current}
              limit={transactionProgress.limit}
              planName={planName}
            />
          )}
          {planLimits && categoryProgress && categoryProgress.current !== null && categoryProgress.limit !== null && (
            <LimitWarning 
              type="category" 
              current={categoryProgress.current}
              limit={categoryProgress.limit}
              planName={planName}
            />
          )}
          
          <TransactionFilters 
            filters={filters}
            onFiltersChange={setFilters}
            categories={categories}
          />
          
          {hasActiveFilters && (
            <FilteredSummaryCards transactions={filteredTransactions} />
          )}

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Todas as Transações</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {filteredTransactions.length} de {transactions.length} transações
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionList 
                transactions={paginatedTransactions} 
                onDelete={onDelete}
                onEdit={onEdit}
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredTransactions.length}
                onPageChange={setCurrentPage}
              />
            </CardContent>
          </Card>
        </div>
      </ErrorBoundary>
    );
  }

  if (currentTab === "categories") {
    return (
      <div className="space-y-4">
        <Button 
          onClick={() => setShowCategoryForm(!showCategoryForm)}
          className="bg-gradient-primary hover:shadow-primary transition-all duration-200"
        >
          <Plus className="h-4 w-4 mr-2" />
          {showCategoryForm ? 'Cancelar' : 'Nova Categoria'}
        </Button>
        
        <CategoryManager 
          categories={categories} 
          onRefresh={onRefresh} 
          showForm={showCategoryForm}
          setShowForm={setShowCategoryForm}
        />
      </div>
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

  if (currentTab === "agenda") {
    return (
      <ErrorBoundary fallback={
        <div className="p-4 text-destructive">
          Erro ao carregar agenda. Tente recarregar a página.
        </div>
      }>
        <CommitmentsManager />
      </ErrorBoundary>
    );
  }

  if (currentTab === "team") {
    return <TeamManagement />;
  }

  if (currentTab === "admin") {
    return <AdminPanel />;
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