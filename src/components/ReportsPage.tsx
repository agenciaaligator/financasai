import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTransactions } from "@/hooks/useTransactions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, BarChart3, Search, Filter, Hash, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format, parseISO, startOfYear, subDays, startOfWeek } from "date-fns";
import { ptBR, enUS, es, it, pt } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { translateCategoryName } from "@/lib/categoryTranslations";
import { formatCurrency } from "@/lib/formatCurrency";

const BRAND_COLORS = ['hsl(207, 50%, 34%)', 'hsl(37, 74%, 67%)', 'hsl(145, 63%, 42%)', 'hsl(0, 85%, 60%)', 'hsl(36, 90%, 51%)', 'hsl(270, 50%, 50%)', 'hsl(180, 50%, 40%)'];

const CATEGORY_EMOJIS: Record<string, string> = {
  'Alimentação': '🍕', 'Food': '🍕', 'Alimentación': '🍕', 'Alimentazione': '🍕',
  'Transporte': '🚗', 'Transport': '🚗', 'Trasporto': '🚗',
  'Lazer': '🎮', 'Entertainment': '🎮', 'Entretenimiento': '🎮', 'Entretenimento': '🎮', 'Intrattenimento': '🎮',
  'Moradia': '🏠', 'Housing': '🏠', 'Vivienda': '🏠', 'Abitazione': '🏠',
  'Vestuário': '👕', 'Clothing': '👕', 'Ropa': '👕', 'Abbigliamento': '👕',
  'Saúde': '💊', 'Health': '💊', 'Salud': '💊', 'Salute': '💊',
  'Educação': '📚', 'Education': '📚', 'Educación': '📚', 'Istruzione': '📚',
  'Salário': '💼', 'Salary': '💼', 'Salario': '💼', 'Stipendio': '💼',
  'Freelance': '💻', 'Investimentos': '📈', 'Investments': '📈', 'Inversiones': '📈', 'Investimenti': '📈',
};

function getDateLocale(lang: string) {
  if (lang.startsWith('en')) return enUS;
  if (lang.startsWith('es')) return es;
  if (lang.startsWith('it')) return it;
  if (lang === 'pt-PT') return pt;
  return ptBR;
}

type PeriodType = 'month' | '3months' | '6months' | 'year' | 'all';
type TypeFilter = 'all' | 'income' | 'expense';

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = subMonths(now, i);
      options.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy', { locale }),
      });
    }
    return options;
  }, [locale]);

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { transactions, categories, loading } = useTransactions();

  const selectedDate = useMemo(() => parseISO(selectedMonth + '-01'), [selectedMonth]);

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'month': {
        const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
        const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
        return { start, end };
      }
      case '3months': {
        const start = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd');
        const end = format(endOfMonth(now), 'yyyy-MM-dd');
        return { start, end };
      }
      case '6months': {
        const start = format(startOfMonth(subMonths(now, 5)), 'yyyy-MM-dd');
        const end = format(endOfMonth(now), 'yyyy-MM-dd');
        return { start, end };
      }
      case 'year': {
        const start = format(startOfYear(now), 'yyyy-MM-dd');
        const end = format(endOfMonth(now), 'yyyy-MM-dd');
        return { start, end };
      }
      case 'all':
        return { start: '1900-01-01', end: '2999-12-31' };
      default:
        return { start: format(startOfMonth(selectedDate), 'yyyy-MM-dd'), end: format(endOfMonth(selectedDate), 'yyyy-MM-dd') };
    }
  }, [period, selectedDate]);

  // Filter transactions
  const filteredTx = useMemo(() => {
    let txs = (transactions || []).filter(tx => tx.date >= dateRange.start && tx.date <= dateRange.end);
    if (typeFilter !== 'all') txs = txs.filter(tx => tx.type === typeFilter);
    if (categoryFilter !== 'all') txs = txs.filter(tx => tx.category_id === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter(tx => tx.title.toLowerCase().includes(q) || tx.description?.toLowerCase().includes(q));
    }
    return txs;
  }, [transactions, dateRange, typeFilter, categoryFilter, searchQuery]);

  // Previous period for comparison
  const prevTx = useMemo(() => {
    if (period !== 'month') return [];
    const prevDate = subMonths(selectedDate, 1);
    const start = format(startOfMonth(prevDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(prevDate), 'yyyy-MM-dd');
    return (transactions || []).filter(tx => tx.date >= start && tx.date <= end);
  }, [transactions, selectedDate, period]);

  const summary = useMemo(() => {
    const income = filteredTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
    const expenses = filteredTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
    const balance = income - expenses;
    const prevIncome = prevTx.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
    const prevExpenses = prevTx.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
    const prevBalance = prevIncome - prevExpenses;
    const variation = prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : (balance > 0 ? 100 : 0);
    const count = filteredTx.length;
    const avgTicket = count > 0 ? (income + expenses) / count : 0;
    const maxIncome = filteredTx.filter(tx => tx.type === 'income').reduce((max, tx) => Math.max(max, Number(tx.amount)), 0);
    const maxExpense = filteredTx.filter(tx => tx.type === 'expense').reduce((max, tx) => Math.max(max, Number(tx.amount)), 0);
    return { income, expenses, balance, prevBalance, variation, diff: balance - prevBalance, count, avgTicket, maxIncome, maxExpense };
  }, [filteredTx, prevTx]);

  // Top expense categories
  const topExpenseCategories = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; color: string }>();
    filteredTx.filter(tx => tx.type === 'expense').forEach(tx => {
      const cat = categories?.find(c => c.id === tx.category_id);
      const rawName = cat?.name || '';
      const name = rawName ? translateCategoryName(rawName, t) : t('reports.uncategorized');
      const color = cat?.color || '#6B7280';
      const existing = map.get(name) || { name, amount: 0, color };
      existing.amount += Number(tx.amount);
      map.set(name, existing);
    });
    const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const total = sorted.reduce((s, c) => s + c.amount, 0);
    return sorted.map(c => ({ ...c, percent: total > 0 ? (c.amount / total) * 100 : 0 }));
  }, [filteredTx, categories, t]);

  // Top income categories
  const topIncomeCategories = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; color: string }>();
    filteredTx.filter(tx => tx.type === 'income').forEach(tx => {
      const cat = categories?.find(c => c.id === tx.category_id);
      const rawName = cat?.name || '';
      const name = rawName ? translateCategoryName(rawName, t) : t('reports.uncategorized');
      const color = cat?.color || '#6B7280';
      const existing = map.get(name) || { name, amount: 0, color };
      existing.amount += Number(tx.amount);
      map.set(name, existing);
    });
    const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const total = sorted.reduce((s, c) => s + c.amount, 0);
    return sorted.map(c => ({ ...c, percent: total > 0 ? (c.amount / total) * 100 : 0 }));
  }, [filteredTx, categories, t]);

  const pieData = useMemo(() =>
    topExpenseCategories.map(c => ({ name: c.name, value: c.amount })),
    [topExpenseCategories]
  );

  // Evolution chart - last 12 months
  const evolutionData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = format(startOfMonth(d), 'yyyy-MM-dd');
      const end = format(endOfMonth(d), 'yyyy-MM-dd');
      const txs = (transactions || []).filter(tx => tx.date >= start && tx.date <= end);
      const inc = txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
      const exp = txs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
      months.push({
        name: format(d, 'MMM', { locale }),
        [t('reports.income')]: inc,
        [t('reports.expenses')]: exp,
        [t('reports.balance')]: inc - exp,
      });
    }
    return months;
  }, [transactions, locale, t]);

  // Monthly averages
  const monthlyAverages = useMemo(() => {
    const now = new Date();
    let totalInc = 0, totalExp = 0, monthCount = 0;
    for (let i = 0; i < 6; i++) {
      const d = subMonths(now, i);
      const start = format(startOfMonth(d), 'yyyy-MM-dd');
      const end = format(endOfMonth(d), 'yyyy-MM-dd');
      const txs = (transactions || []).filter(tx => tx.date >= start && tx.date <= end);
      if (txs.length > 0) monthCount++;
      totalInc += txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
      totalExp += txs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
    }
    const n = Math.max(monthCount, 1);
    return { avgIncome: totalInc / n, avgExpense: totalExp / n, avgBalance: (totalInc - totalExp) / n };
  }, [transactions]);

  // Active filters count
  const activeFilters = [typeFilter !== 'all', categoryFilter !== 'all', searchQuery.trim() !== ''].filter(Boolean).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">📊 {t('reports.title')}</h2>
        
        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Period selector */}
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-44">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t('reports.periodMonth', 'Mês específico')}</SelectItem>
              <SelectItem value="3months">{t('reports.period3Months', 'Últimos 3 meses')}</SelectItem>
              <SelectItem value="6months">{t('reports.period6Months', 'Últimos 6 meses')}</SelectItem>
              <SelectItem value="year">{t('reports.periodYear', 'Este ano')}</SelectItem>
              <SelectItem value="all">{t('reports.periodAll', 'Todo período')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Month selector (only when period = month) */}
          {period === 'month' && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-52 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="capitalize">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allTransactions', 'Todas')}</SelectItem>
              <SelectItem value="income">{t('filters.onlyIncome', 'Receitas')}</SelectItem>
              <SelectItem value="expense">{t('filters.onlyExpenses', 'Despesas')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('reports.allCategories', 'Todas categorias')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('reports.allCategories', 'Todas categorias')}</SelectItem>
              {(categories || []).map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    {translateCategoryName(cat.name, t)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('filters.searchPlaceholder', 'Buscar...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {activeFilters > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFilters} {activeFilters === 1 ? t('filters.activeFilter') : t('filters.activeFilters')}
            </Badge>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={t('reports.income')}
          value={formatCurrency(summary.income)}
          icon={<TrendingUp className="h-6 w-6" />}
          variant="success"
        />
        <MetricCard
          label={t('reports.expenses')}
          value={formatCurrency(summary.expenses)}
          icon={<TrendingDown className="h-6 w-6" />}
          variant="danger"
        />
        <MetricCard
          label={t('reports.balance')}
          value={formatCurrency(Math.abs(summary.balance))}
          icon={<DollarSign className="h-6 w-6" />}
          variant={summary.balance >= 0 ? 'success' : 'danger'}
          prefix={summary.balance < 0 ? '-' : ''}
        />
        {period === 'month' ? (
          <MetricCard
            label={t('reports.variation')}
            value={`${summary.variation >= 0 ? '+' : ''}${summary.variation.toFixed(1)}%`}
            subtitle={`${summary.diff >= 0 ? '+' : ''}${formatCurrency(summary.diff)}`}
            icon={summary.variation >= 0 ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
            variant={summary.variation >= 0 ? 'primary' : 'warning'}
          />
        ) : (
          <MetricCard
            label={t('reports.transactionCount', 'Transações')}
            value={String(summary.count)}
            subtitle={t('reports.avgTicket', 'Ticket médio: {{value}}', { value: formatCurrency(summary.avgTicket) })}
            icon={<Hash className="h-6 w-6" />}
            variant="primary"
          />
        )}
      </div>

      {/* Period Summary (when not month) */}
      {period !== 'month' && summary.count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">{t('reports.transactionCount', 'Transações')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{summary.count}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">{t('reports.avgTicketLabel', 'Ticket Médio')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(summary.avgTicket)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">{t('reports.maxIncome', 'Maior Receita')}</p>
              <p className="text-2xl font-bold text-success mt-1">{formatCurrency(summary.maxIncome)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/80 border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">{t('reports.maxExpense', 'Maior Despesa')}</p>
              <p className="text-2xl font-bold text-destructive mt-1">{formatCurrency(summary.maxExpense)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Averages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/80 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('reports.avgMonthlyIncome', 'Média Receita (6m)')}</p>
            <p className="text-xl font-bold text-success mt-1">{formatCurrency(monthlyAverages.avgIncome)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('reports.avgMonthlyExpense', 'Média Despesa (6m)')}</p>
            <p className="text-xl font-bold text-destructive mt-1">{formatCurrency(monthlyAverages.avgExpense)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/80 border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">{t('reports.avgMonthlyBalance', 'Média Saldo (6m)')}</p>
            <p className={`text-xl font-bold mt-1 ${monthlyAverages.avgBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(monthlyAverages.avgBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Top 5 Expenses */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">{t('reports.expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={false} outerRadius={90} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                {t('reports.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 12-month evolution line chart */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">{t('reports.yearEvolution', 'Evolução 12 Meses')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={v => {
                  const sym = i18n.language.startsWith('en') ? '$' : 'R$';
                  return v >= 1000 ? `${sym}${(v / 1000).toFixed(0)}k` : `${sym}${v}`;
                }} width={65} />
                <Tooltip formatter={v => formatCurrency(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey={t('reports.income')} stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={t('reports.expenses')} stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={t('reports.balance')} stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Categories Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Expense Categories */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-destructive" />
              {t('reports.topExpenseCategories', 'Top Categorias de Gastos')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topExpenseCategories.length > 0 ? (
              <div className="space-y-3">
                {topExpenseCategories.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}.</span>
                    <span className="text-xl">{CATEGORY_EMOJIS[cat.name] || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground truncate">{cat.name}</span>
                        <span className="text-sm font-semibold text-foreground ml-2">
                          {formatCurrency(cat.amount)} ({cat.percent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${cat.percent}%`, backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">{t('reports.noExpenses')}</p>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Income Categories */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-success" />
              {t('reports.topIncomeCategories', 'Top Categorias de Receita')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topIncomeCategories.length > 0 ? (
              <div className="space-y-3">
                {topIncomeCategories.map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}.</span>
                    <span className="text-xl">{CATEGORY_EMOJIS[cat.name] || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground truncate">{cat.name}</span>
                        <span className="text-sm font-semibold text-foreground ml-2">
                          {formatCurrency(cat.amount)} ({cat.percent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${cat.percent}%`, backgroundColor: BRAND_COLORS[(i + 2) % BRAND_COLORS.length] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">{t('reports.noIncome', 'Nenhuma receita registrada.')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {filteredTx.length > 0 && period === 'month' && (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">💡 {t('reports.insights')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.balance < 0 && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="font-semibold text-destructive">⚠️ {t('reports.insightLoss')}</p>
                <p className="text-sm text-destructive/80 mt-1">
                  {t('reports.insightLossDesc', { value: formatCurrency(Math.abs(summary.balance)) })}
                </p>
              </div>
            )}
            {summary.balance > 0 && (
              <div className="p-4 rounded-xl bg-[hsl(var(--success))]/10 border border-[hsl(var(--success))]/20">
                <p className="font-semibold text-[hsl(var(--success))]">✅ {t('reports.insightProfit')}</p>
                <p className="text-sm text-[hsl(var(--success))]/80 mt-1">
                  {t('reports.insightProfitDesc', { value: formatCurrency(summary.balance) })}
                </p>
              </div>
            )}
            {summary.variation < -20 && (
              <div className="p-4 rounded-xl bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20">
                <p className="font-semibold text-[hsl(var(--warning))]">📉 {t('reports.insightDecline')}</p>
                <p className="text-sm text-[hsl(var(--warning))]/80 mt-1">
                  {t('reports.insightDeclineDesc', { percent: Math.abs(summary.variation).toFixed(0) })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {filteredTx.length === 0 && (
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-lg">📊 {t('reports.noData')}</p>
            <p className="text-muted-foreground text-sm mt-2">{t('reports.noDataDesc')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, subtitle, icon, variant, prefix = '' }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  variant: 'success' | 'danger' | 'primary' | 'warning';
  prefix?: string;
}) {
  const styles = {
    success: 'from-[hsl(var(--success))]/10 to-[hsl(var(--success))]/5 border-[hsl(var(--success))]/20 text-[hsl(var(--success))]',
    danger: 'from-destructive/10 to-destructive/5 border-destructive/20 text-destructive',
    primary: 'from-primary/10 to-primary/5 border-primary/20 text-primary',
    warning: 'from-[hsl(var(--warning))]/10 to-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]',
  };

  return (
    <Card className={`bg-gradient-to-br ${styles[variant]} backdrop-blur-sm hover:-translate-y-0.5`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
            <p className="text-xl sm:text-2xl font-bold mt-1 truncate">{prefix}{value}</p>
            {subtitle && <p className="text-xs mt-1 opacity-70">{subtitle}</p>}
          </div>
          <div className="opacity-60">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
