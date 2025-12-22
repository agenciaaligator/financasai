import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
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
import { WhatsAppPage } from "./WhatsAppPage";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
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
  const { canViewOthers, organization_id, role } = useOrganizationPermissions();
  const { user } = useAuth();
  
  // FASE 2: Buscar membros da organização
  const [orgMembers, setOrgMembers] = useState<Array<{id: string, name: string}>>([]);
  
  useEffect(() => {
    const fetchOrgMembers = async () => {
      if (!organization_id || !user) return;
      
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('organization_id', organization_id);
      
      if (!error && data) {
        setOrgMembers(data.map((m: any) => ({
          id: m.user_id,
          name: m.profiles?.full_name || m.profiles?.email || 'Sem nome'
        })));
      }
    };
    
    fetchOrgMembers();
  }, [organization_id, user]);
  
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
          responsible: parsed.responsible || 'all'
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
      responsible: 'all'
    };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  
  // 🔄 Carregar showOnlyMine do localStorage
  const [showOnlyMine, setShowOnlyMine] = useState(() => {
    try {
      const saved = localStorage.getItem('transactions_showOnlyMine_v1');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // 💾 Salvar filtros no localStorage quando mudarem
  useEffect(() => {
    try {
      localStorage.setItem('transactions_filters_v1', JSON.stringify(filters));
    } catch (e) {
      console.warn('Erro ao salvar filtros:', e);
    }
  }, [filters]);

  // 💾 Salvar showOnlyMine no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('transactions_showOnlyMine_v1', showOnlyMine.toString());
    } catch (e) {
      console.warn('Erro ao salvar showOnlyMine:', e);
    }
  }, [showOnlyMine]);

  // Reset para página 1 quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, showOnlyMine]);

  const filteredTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    
    return transactions.filter(transaction => {
      // Filtro "Ver apenas minhas" se habilitado (funciona se há organization_id)
      if (showOnlyMine && organization_id && user?.id && transaction.user_id !== user.id) {
        return false;
      }
      // Filtro de período
      if (filters.period !== 'all') {
        try {
          const transactionDate = toZonedTime(parseISO(transaction.date), TIMEZONE);
          let startDate: Date;
          let endDate: Date;

          switch (filters.period) {
            case 'today': {
              // 🔧 FIX: Comparar datas como string para evitar problema de timezone
              const todayStr = now.toISOString().split('T')[0]; // yyyy-mm-dd
              const transactionDateStr = transaction.date; // já está em yyyy-mm-dd
              
              if (transactionDateStr !== todayStr) {
                return false;
              }
              // Continuar para os próximos filtros
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

      // FASE 2: Filtro de responsável
      if (filters.responsible !== 'all' && transaction.user_id !== filters.responsible) {
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
  
  // FASE 3: Calcular valores filtrados para dashboard quando showOnlyMine está ativo
  const visibleTransactions = useMemo(() => {
    // Aplicar showOnlyMine independente de canViewOthers (se tiver organization_id, já pode filtrar)
    if (!showOnlyMine || !organization_id || !user?.id) {
      return transactions;
    }
    return transactions.filter(t => t.user_id === user.id);
  }, [transactions, showOnlyMine, organization_id, user]);

  // 🔧 FIX CRÍTICO: Filtrar apenas transações do mês atual para o SummaryCards
  const currentMonthTransactions = useMemo(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return visibleTransactions.filter(t => {
      try {
        const transactionDate = toZonedTime(parseISO(t.date), TIMEZONE);
        return isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
      } catch {
        return false;
      }
    });
  }, [visibleTransactions]);

  // Usar transações do mês atual para os cards de resumo (CORRIGIDO)
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

  // Manter visibleBalance/Income/Expenses para gráfico e lista (sem filtro de mês)
  const visibleBalance = useMemo(() => {
    return visibleTransactions.reduce((acc, transaction) => {
      if (transaction.type === 'income') {
        return acc + Number(transaction.amount);
      } else {
        return acc - Number(transaction.amount);
      }
    }, 0);
  }, [visibleTransactions]);

  const visibleTotalIncome = useMemo(() => {
    return visibleTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [visibleTransactions]);

  const visibleTotalExpenses = useMemo(() => {
    return visibleTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount), 0);
  }, [visibleTransactions]);

  if (currentTab === "dashboard") {
    // 📊 Diagnóstico de visibilidade
    const myTransactions = transactions.filter(t => t.user_id === user?.id);
    const orgTransactions = organization_id ? transactions.filter(t => t.organization_id === organization_id) : [];
    const myTransactionsWithOrg = myTransactions.filter(t => t.organization_id);
    const myTransactionsWithoutOrg = myTransactions.filter(t => !t.organization_id);
    
    return (
      <div className="space-y-6">
        <BalanceAlert isNegative={isNegative} />
        
        {/* 🔍 Card de Diagnóstico de Visibilidade */}
        {organization_id && (
          <Card className="bg-muted/50 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                🔍 Diagnóstico de Visibilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Organização ativa:</p>
                  <p className="font-mono text-xs">{organization_id.substring(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Permissão ver outros:</p>
                  <p className="font-semibold">{canViewOthers ? '✅ Sim' : '❌ Não'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Minhas transações:</p>
                  <p className="font-semibold">{myTransactions.length} total</p>
                  <p className="text-xs text-muted-foreground">
                    {myTransactionsWithOrg.length} com org_id | {myTransactionsWithoutOrg.length} sem org_id
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Da organização:</p>
                  <p className="font-semibold">{orgTransactions.length} total</p>
                </div>
              </div>
              
              {!canViewOthers && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mt-2">
                  <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                    💡 <strong>Membro sem permissão:</strong> Você está vendo apenas suas próprias transações.
                  </p>
                </div>
              )}
              
              {myTransactionsWithoutOrg.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 mt-2">
                  <p className="text-blue-700 dark:text-blue-300 text-xs">
                    ℹ️ <strong>Transações antigas detectadas:</strong> Você tem {myTransactionsWithoutOrg.length} transações sem organization_id (criadas antes da correção). Novas transações via WhatsApp já incluem organization_id automaticamente.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* FASE 3: Switch "Ver apenas minhas transações" no dashboard */}
        {organization_id && (
          <div className="flex items-center justify-end space-x-2">
            <Switch
              id="dashboard-show-only-mine"
              checked={showOnlyMine}
              onCheckedChange={setShowOnlyMine}
            />
            <Label htmlFor="dashboard-show-only-mine" className="cursor-pointer">
              Ver apenas minhas transações
            </Label>
          </div>
        )}
        
        <SummaryCards
          balance={monthlyBalance}
          totalIncome={monthlyTotalIncome}
          totalExpenses={monthlyTotalExpenses}
        />
        
        <div className="space-y-6">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle>Gráfico Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialChart transactions={visibleTransactions} />
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Últimas Transações</CardTitle>
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
                transactions={visibleTransactions.slice(0, 10)} 
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
    
    // 📊 Diagnóstico de visibilidade na aba de transações
    const myTransactions = transactions.filter(t => t.user_id === user?.id);
    const orgTransactions = organization_id ? transactions.filter(t => t.organization_id === organization_id) : [];

    return (
      <ErrorBoundary>
        <div className="space-y-4">
          {/* 🔍 Diagnóstico no topo da aba de transações */}
          {organization_id && (
            <Card className="bg-muted/50 border-primary/20">
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <span className="text-muted-foreground">Permissão ver outros: </span>
                    <span className="font-semibold">{canViewOthers ? '✅ Sim' : '❌ Não'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Minhas: </span>
                    <span className="font-semibold">{myTransactions.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Da org: </span>
                    <span className="font-semibold">{orgTransactions.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Filtradas: </span>
                    <span className="font-semibold">{filteredTransactions.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <AddTransactionButton 
              showForm={showTransactionForm}
              onToggle={onToggleTransactionForm}
            />
            
            {organization_id && (
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
            orgMembers={orgMembers}
          />
          
          {hasActiveFilters && (
            <FilteredSummaryCards transactions={filteredTransactions} />
          )}

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Todas as Transações</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-normal text-muted-foreground">
                    {filteredTransactions.length} de {transactions.length} transações
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
                    ℹ️ <strong>Filtros ativos:</strong> Mostrando {filteredTransactions.length} de {transactions.length} transações
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
                      responsible: 'all'
                    })}
                  >
                    Limpar filtros
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
                  responsible: 'all'
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

  if (currentTab === "whatsapp") {
    return <WhatsAppPage />;
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