import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Lightbulb } from "lucide-react";
import { FinancialChart } from "../FinancialChart";
import { CategoryManager } from "../CategoryManager";
import { ProfileSettings } from "../ProfileSettings";
import { ReportsPage } from "../ReportsPage";
import { MonthlyGoalsSection } from "./MonthlyGoalsSection";
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
import { useMonthlyGoals } from "@/hooks/useMonthlyGoals";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import donaWilmaAvatar from "@/assets/dona-wilma-avatar.jpg";
import { useAuth } from "@/hooks/useAuth";
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subMonths,
  subDays,
  isWithinInterval,
  parseISO,
  format
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ErrorBoundary } from "../ErrorBoundary";
import { WhatsAppPage } from "./WhatsAppPage";
import { AgendaPage } from "./AgendaPage";
import { useTranslation } from "react-i18next";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { Calendar as CalendarIcon } from "lucide-react";

const TIMEZONE = 'America/Sao_Paulo';
const ITEMS_PER_PAGE = 10;

const TIPS_KEYS = [
  'dashboard.tips.0',
  'dashboard.tips.1',
  'dashboard.tips.2',
  'dashboard.tips.3',
];

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
  onTabChange: (tab: string) => void;
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
  onToggleTransactionForm,
  onTabChange
}: DashboardContentProps) {
  const { planName, planLimits } = useSubscription();
  const { getTransactionProgress, getCategoryProgress } = useFeatureLimits();
  const { goalsWithProgress, loading: goalsLoading, addGoal, deleteGoal } = useMonthlyGoals(transactions, categories);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { connection: calendarConnection } = useGoogleCalendar();
  const calendarConnected = !!calendarConnection?.is_active && !calendarConnection?.needs_reauth;
  
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

  // Sparkline data: last 7 days
  const sparklineData = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(format(subDays(now, i), 'yyyy-MM-dd'));
    }

    const income = days.map(day =>
      transactions
        .filter(t => t.date === day && t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0)
    );

    const expense = days.map(day =>
      transactions
        .filter(t => t.date === day && t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0)
    );

    const balanceArr = days.map((_, i) => {
      let b = 0;
      for (let j = 0; j <= i; j++) {
        b += income[j] - expense[j];
      }
      return b;
    });

    return { income, expense, balance: balanceArr };
  }, [transactions]);

  const handleViewAllTransactions = () => {
    onTabChange('transactions');
  };

  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    return !localStorage.getItem('first_dashboard_seen');
  });

  const dismissWelcomeBanner = () => {
    localStorage.setItem('first_dashboard_seen', 'true');
    setShowWelcomeBanner(false);
  };

  // Daily tip
  const tipOfDay = t(TIPS_KEYS[new Date().getDate() % TIPS_KEYS.length]);

  if (currentTab === "dashboard") {
    return (
      <div className="space-y-4">
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Hero Welcome Card - spans 2 cols on desktop */}
          <Card className="md:col-span-2 border-0 shadow-sm bg-gradient-to-r from-card to-muted/30">
            <CardContent className="p-4 flex items-center gap-4">
              <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-primary/20">
                <AvatarImage src={donaWilmaAvatar} alt="Dona Wilma" className="object-cover object-top" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">DW</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-base font-bold text-foreground truncate">
                  {t('dashboard.greeting', 'Olá! 🎉')} {user?.email && <span className="font-medium text-sm text-muted-foreground">{user.email}</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.greetingSubtitle', 'Dona Wilma está pronta. Suas finanças hoje:')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                    WhatsApp
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Alert or Tip of Day */}
          {isNegative ? (
            <BalanceAlert isNegative={isNegative} />
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-1">
                    {t('dashboard.tipOfDay', 'Dica do dia')}
                  </p>
                  <p className="text-sm text-foreground">{tipOfDay}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <SummaryCards
            balance={monthlyBalance}
            totalIncome={monthlyTotalIncome}
            totalExpenses={monthlyTotalExpenses}
            sparklineData={sparklineData}
          />

          {/* Chart Card - spans 2 cols */}
          <Card className="md:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="font-heading text-sm">{t('chart.howIsYourMoney', 'Como seu dinheiro se comportou')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <FinancialChart transactions={currentMonthTransactions} />
            </CardContent>
          </Card>

          {/* Balance Alert if negative (shown in chart row) */}
          {isNegative && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-1">
                    {t('dashboard.tipOfDay', 'Dica do dia')}
                  </p>
                  <p className="text-sm text-foreground">{tipOfDay}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Welcome banner */}
        {showWelcomeBanner && (
          <Card className="bg-primary/5 border-primary/10 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">🎉 {t('dashboard.welcomeTitle', 'Bem-vindo ao Dona Wilma!')}</h3>
                  <p className="text-xs text-muted-foreground">{t('dashboard.welcomeDesc', 'Envie mensagens pelo WhatsApp para registrar suas finanças:')}</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li>{t('dashboard.welcomeTip1', '"Gastei 50 no mercado"')}</li>
                    <li>{t('dashboard.welcomeTip2', '"Recebi 3000 de salário"')}</li>
                  </ul>
                </div>
                <Button variant="ghost" size="sm" onClick={dismissWelcomeBanner} className="h-6 w-6 p-0 text-muted-foreground">✕</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="font-heading text-sm">{t('transactionList.yourLatestMovements', 'Últimas movimentações')}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <TransactionList 
              transactions={transactions.slice(0, 5)} 
              onDelete={onDelete}
              onEdit={onEdit}
            />
            {transactions.length > 5 && (
              <div className="mt-3 text-center">
                <Button variant="link" size="sm" onClick={handleViewAllTransactions} className="text-xs">
                  {t('transactionList.viewAllTransactions', 'Ver todas as transações')} →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-heading text-sm">{t('transactionList.yourConversations', 'Suas transações financeiras')}</span>
                  <p className="text-xs font-normal text-muted-foreground mt-1">
                    {t('transactionList.allIncomeAndExpenses', 'Todas as suas receitas e despesas')}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('transactionList.ofTotal', '{{filtered}} de {{total}} transações', { filtered: filteredTransactions.length, total: transactions.length })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    className="h-7 w-7 p-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
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

  if (currentTab === "goals") {
    return (
      <MonthlyGoalsSection
        goalsWithProgress={goalsWithProgress}
        categories={categories}
        existingGoalCategoryIds={goalsWithProgress.map(gp => gp.goal.category_id)}
        onAddGoal={addGoal}
        onDeleteGoal={deleteGoal}
        loading={goalsLoading}
      />
    );
  }

  if (currentTab === "profile") {
    return <ProfileSettings />;
  }

  if (currentTab === "agenda") {
    return <AgendaPage />;
  }

  if (currentTab === "whatsapp") {
    return <WhatsAppPage />;
  }

  if (currentTab === "admin") {
    return <AdminPanel />;
  }

  // Fallback
  return (
    <div className="space-y-4">
      <BalanceAlert isNegative={isNegative} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCards 
          balance={balance}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
        />
      </div>
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-sm">{t('chart.howIsYourMoney', 'Como seu dinheiro se comportou')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FinancialChart transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
