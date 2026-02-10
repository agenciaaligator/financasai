import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";

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
import { WhatsAppPage } from "./WhatsAppPage";
import { useTranslation } from "react-i18next";
import { RecurringTransactionsManager } from "../RecurringTransactionsManager";

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
  const { t } = useTranslation();
  
  // 🔄 Carregar filtros do localStorage na montagem
  const [filters, setFilters] = useState<TransactionFiltersState>(() => {
    try {
      const saved = localStorage.getItem('transactions_filters_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          period: parsed.period || 'all',
          customDateRange: parsed.customDateRange || { start: null, end: null },
          type: parsed.type || 'all',
          categories: parsed.categories || [],
          source: parsed.source || 'all',
          searchText: parsed.searchText || '',
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar filtros do localStorage:', e);
    }
    return {
      period: 'all',
      customDateRange: { start: null, end: null },
      type: 'all',
      categories: [],
      source: 'all',
      searchText: '',
    };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // 💾 Salvar filtros no localStorage quando mudarem
  useEffect(() => {
    try {
      localStorage.setItem('transactions_filters_v1', JSON.stringify(filters));
    } catch (e) {
      console.warn('Erro ao salvar filtros:', e);
    }
  }, [filters]);

  // Reset para página 1 quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    
    return transactions.filter(transaction => {
      // Filtro de período
      if (filters.period !== 'all') {
        try {
          const transactionDate = toZonedTime(parseISO(transaction.date), TIMEZONE);
          let startDate: Date;
          let endDate: Date;

          switch (filters.period) {
            case 'today': {
              const todayStr = now.toISOString().split('T')[0];
              const transactionDateStr = transaction.date;
              if (transactionDateStr !== todayStr) {
                return false;
              }
              break;
            }
            case 'week':
              startDate = startOfWeek(now, { weekStartsOn: 0 });
              endDate = endOfWeek(now, { weekStartsOn: 0 });
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
                return false;
              }
              break;
            case 'month':
              startDate = startOfMonth(now);
              endDate = endOfMonth(now);
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
                return false;
              }
              break;
            case '30days':
              startDate = startOfDay(subDays(now, 30));
              endDate = endOfDay(now);
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
                return false;
              }
              break;
            case '90days':
              startDate = startOfDay(subDays(now, 90));
              endDate = endOfDay(now);
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
                return false;
              }
              break;
            case 'year':
              startDate = startOfYear(now);
              endDate = endOfYear(now);
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
                return false;
              }
              break;
            case 'custom':
              if (filters.customDateRange.start && filters.customDateRange.end) {
                startDate = startOfDay(toZonedTime(filters.customDateRange.start, TIMEZONE));
                endDate = endOfDay(toZonedTime(filters.customDateRange.end, TIMEZONE));
                if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) {
                  return false;
                }
              }
              break;
            default:
              break;
          }
        } catch (error) {
          console.warn('[DashboardContent] Data inválida na transação:', transaction.id, transaction.date);
          return true;
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

  // 🔧 FIX CRÍTICO: Filtrar apenas transações do mês atual para o SummaryCards
  const currentMonthTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return transactions.filter(t => {
      try {
        const transactionDate = toZonedTime(parseISO(t.date), TIMEZONE);
        return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });
  }, [transactions]);

  // Usar transações do mês atual para os cards de resumo
  const monthlyBalance = useMemo(() => {
    return currentMonthTransactions.reduce((acc, transaction) => {
      if (transaction.type === 'income') {
        return acc + Number(transaction.amount);
      } else {
        return acc - Number(transaction.amount);
      }
    }, 0);
  }, [currentMonthTransactions]);

  const monthlyTotalIncome = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [currentMonthTransactions]);

  const monthlyTotalExpenses = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [currentMonthTransactions]);

  if (currentTab === "dashboard") {
    return (
      <div className="space-y-6">
        <BalanceAlert isNegative={isNegative} />
        
        <SummaryCards
          balance={monthlyBalance}
          totalIncome={monthlyTotalIncome}
          totalExpenses={monthlyTotalExpenses}
        />
        
        <div className="space-y-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>{t('chart.financialChart', 'Gráfico Financeiro')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialChart transactions={transactions} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>{t('transactionList.latestTransactions', 'Últimas Transações')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
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
                <span>{t('transactionList.allTransactions', 'Todas as Transações')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-normal text-muted-foreground">
                    {t('transactionList.ofTotal', '{{filtered}} de {{total}} transações', { filtered: filteredTransactions.length, total: transactions.length })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    className="h-8 w-8 p-0"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasActiveFilters && filteredTransactions.length > 0 && (
                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm flex items-center justify-between">
                  <p className="text-blue-800 dark:text-blue-200">
                    ℹ️ <strong>{t('transactionList.activeFiltersInfo', 'Filtros ativos:')}</strong> {t('transactionList.showingFiltered', 'Mostrando {{filtered}} de {{total}} transações', { filtered: filteredTransactions.length, total: transactions.length })}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFilters({
                      period: 'all',
                      customDateRange: { start: null, end: null },
                      type: 'all',
                      categories: [],
                      source: 'all',
                      searchText: '',
                    })}
                  >
                    {t('transactionList.clearFilters', 'Limpar filtros')}
                  </Button>
                </div>
              )}
              <TransactionList 
                transactions={paginatedTransactions} 
                onDelete={onDelete}
                onEdit={onEdit}
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredTransactions.length}
                onPageChange={setCurrentPage}
                onRefresh={onRefresh}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={() => setFilters({
                  period: 'all',
                  customDateRange: { start: null, end: null },
                  type: 'all',
                  categories: [],
                  source: 'all',
                  searchText: '',
                })}
                totalTransactionsCount={transactions.length}
              />
            </CardContent>
          </Card>
        </div>
      </ErrorBoundary>
    );
  }

  if (currentTab === "recurring") {
    return (
      <ErrorBoundary>
        <RecurringTransactionsManager categories={categories} />
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
          {showCategoryForm ? t('common.cancel', 'Cancelar') : t('sidebar.categoriesDesc', 'Nova Categoria')}
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

  if (currentTab === "future") {
    return <FutureFeatures />;
  }

  if (currentTab === "profile") {
    return <ProfileSettings />;
  }

  if (currentTab === "whatsapp") {
    return <WhatsAppPage />;
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
            <CardTitle>{t('chart.financialChart', 'Gráfico Financeiro')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FinancialChart transactions={transactions} />
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>{t('transactionList.recentTransactions', 'Transações Recentes')}</CardTitle>
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
