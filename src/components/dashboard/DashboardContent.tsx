import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
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
  subMonths,
  isWithinInterval,
  parseISO
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ErrorBoundary } from "../ErrorBoundary";
import { WhatsAppPage } from "./WhatsAppPage";
import { useTranslation } from "react-i18next";

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
  
  const [filters, setFilters] = useState<TransactionFiltersState>(() => {
    try {
      const saved = localStorage.getItem('transactions_filters_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          period: parsed.period || 'all',
          type: parsed.type || 'all',
          searchText: parsed.searchText || '',
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar filtros do localStorage:', e);
    }
    return {
      period: 'all',
      type: 'all',
      searchText: '',
    };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('transactions_filters_v2', JSON.stringify(filters));
    } catch (e) {
      console.warn('Erro ao salvar filtros:', e);
    }
  }, [filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    
    return transactions.filter(transaction => {
      if (filters.period !== 'all') {
        try {
          const transactionDate = toZonedTime(parseISO(transaction.date), TIMEZONE);
          let startDate: Date;
          let endDate: Date;

          switch (filters.period) {
            case 'today': {
              const todayStr = now.toISOString().split('T')[0];
              if (transaction.date !== todayStr) return false;
              break;
            }
            case 'week':
              startDate = startOfWeek(now, { weekStartsOn: 0 });
              endDate = endOfWeek(now, { weekStartsOn: 0 });
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) return false;
              break;
            case 'month':
              startDate = startOfMonth(now);
              endDate = endOfMonth(now);
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) return false;
              break;
            case 'last_month': {
              const lastMonth = subMonths(now, 1);
              startDate = startOfMonth(lastMonth);
              endDate = endOfMonth(lastMonth);
              if (!isWithinInterval(transactionDate, { start: startDate, end: endDate })) return false;
              break;
            }
          }
        } catch (error) {
          console.warn('[DashboardContent] Data inválida na transação:', transaction.id, transaction.date);
          return true;
        }
      }

      if (filters.type !== 'all' && transaction.type !== filters.type) return false;

      if (filters.searchText.trim() !== '') {
        const searchLower = filters.searchText.toLowerCase();
        const titleMatch = transaction.title.toLowerCase().includes(searchLower);
        const descMatch = transaction.description?.toLowerCase().includes(searchLower);
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [transactions, filters]);

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

  const monthlyBalance = useMemo(() => {
    return currentMonthTransactions.reduce((acc, transaction) => {
      if (transaction.type === 'income') return acc + Number(transaction.amount);
      else return acc - Number(transaction.amount);
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

  // Helper to switch to transactions tab
  const handleViewAllTransactions = () => {
    // Dispatch custom event to switch tab
    window.dispatchEvent(new CustomEvent('switchTab', { detail: 'transactions' }));
  };

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    return !localStorage.getItem('first_dashboard_seen');
  });

  const dismissWelcomeBanner = () => {
    localStorage.setItem('first_dashboard_seen', 'true');
    setShowWelcomeBanner(false);
  };

  if (currentTab === "dashboard") {
    return (
      <div className="space-y-6">
        {/* Header Acolhedor */}
        <Card className="relative dw-card bg-card shadow-card border-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/20 rounded-full blur-3xl -translate-y-8 translate-x-8"></div>
          <CardContent className="p-8 relative">
            <h1 className="font-heading text-[2.5rem] font-semibold text-foreground mb-2">
              Olá! 🎉
            </h1>
            <p className="text-lg text-muted-foreground">
              Como estão suas finanças hoje? Vamos dar uma olhada...
            </p>
          </CardContent>
        </Card>

        {showWelcomeBanner && (
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">🎉 {t('dashboard.welcomeTitle', 'Bem-vindo ao Dona Wilma!')}</h3>
                  <p className="text-sm text-muted-foreground">{t('dashboard.welcomeDesc', 'Envie mensagens pelo WhatsApp para registrar suas finanças:')}</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>{t('dashboard.welcomeTip1', '"Gastei 50 no mercado"')}</li>
                    <li>{t('dashboard.welcomeTip2', '"Recebi 3000 de salário"')}</li>
                    <li>{t('dashboard.welcomeTip3', '"Reunião amanhã às 14h"')}</li>
                  </ul>
                </div>
                <Button variant="ghost" size="sm" onClick={dismissWelcomeBanner}>✕</Button>
              </div>
            </CardContent>
          </Card>
        )}
        <BalanceAlert isNegative={isNegative} />
        
        <SummaryCards
          balance={monthlyBalance}
          totalIncome={monthlyTotalIncome}
          totalExpenses={monthlyTotalExpenses}
        />
        
        <div className="space-y-6">
          <Card className="dw-card bg-card shadow-card border-0">
            <CardHeader>
              <CardTitle className="font-heading">{t('chart.howIsYourMoney', 'Como seu dinheiro se comportou')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialChart transactions={currentMonthTransactions} />
            </CardContent>
          </Card>

          <Card className="dw-card bg-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>💬 {t('transactionList.yourLatestMovements', 'Suas últimas conversas financeiras')}</CardTitle>
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
                transactions={transactions.slice(0, 5)} 
                onDelete={onDelete}
                onEdit={onEdit}
              />
              {transactions.length > 5 && (
                <div className="mt-4 text-center">
                  <Button variant="link" onClick={handleViewAllTransactions}>
                    {t('transactionList.viewAllTransactions', 'Ver todas as transações')} →
                  </Button>
                </div>
              )}
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
                <div>
                  <span>{t('transactionList.yourTransactions', 'Suas Transações')}</span>
                  <p className="text-sm font-normal text-muted-foreground mt-1">
                    {t('transactionList.allIncomeAndExpenses', 'Todas as suas receitas e despesas')}
                  </p>
                </div>
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
                  type: 'all',
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
      
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>{t('chart.howIsYourMoney', 'Como está seu dinheiro este mês')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialChart transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
