import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/hooks/useTransactions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from "date-fns";
import { ptBR, enUS, es, it, pt } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

const BRAND_COLORS = ['hsl(207, 50%, 34%)', 'hsl(37, 74%, 67%)', 'hsl(145, 63%, 42%)', 'hsl(0, 85%, 60%)', 'hsl(36, 90%, 51%)'];

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

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);

  // Generate last 12 months options
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
  const { transactions, categories, loading } = useTransactions();

  const selectedDate = useMemo(() => parseISO(selectedMonth + '-01'), [selectedMonth]);
  const prevDate = useMemo(() => subMonths(selectedDate, 1), [selectedDate]);

  const filterByMonth = (date: Date) => {
    const start = format(startOfMonth(date), 'yyyy-MM-dd');
    const end = format(endOfMonth(date), 'yyyy-MM-dd');
    return (transactions || []).filter(t => t.date >= start && t.date <= end);
  };

  const currentTx = useMemo(() => filterByMonth(selectedDate), [transactions, selectedDate]);
  const prevTx = useMemo(() => filterByMonth(prevDate), [transactions, prevDate]);

  const summary = useMemo(() => {
    const income = currentTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expenses = currentTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const prevIncome = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const prevExpenses = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const prevBalance = prevIncome - prevExpenses;
    const balance = income - expenses;
    const variation = prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : (balance > 0 ? 100 : 0);
    return { income, expenses, balance, prevBalance, variation, diff: balance - prevBalance };
  }, [currentTx, prevTx]);

  const topCategories = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; color: string }>();
    currentTx.filter(t => t.type === 'expense').forEach(tx => {
      const cat = categories?.find(c => c.id === tx.category_id);
      const name = cat?.name || t('reports.uncategorized');
      const color = cat?.color || '#6B7280';
      const existing = map.get(name) || { name, amount: 0, color };
      existing.amount += Number(tx.amount);
      map.set(name, existing);
    });
    const sorted = Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const total = sorted.reduce((s, c) => s + c.amount, 0);
    return sorted.map(c => ({ ...c, percent: total > 0 ? (c.amount / total) * 100 : 0 }));
  }, [currentTx, categories, t]);

  const pieData = useMemo(() =>
    topCategories.map(c => ({ name: c.name, value: c.amount })),
    [topCategories]
  );

  const barData = useMemo(() => {
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const d = subMonths(selectedDate, i);
      const txs = filterByMonth(d);
      const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      months.push({
        name: format(d, 'MMM', { locale }),
        [t('reports.income')]: inc,
        [t('reports.expenses')]: exp,
      });
    }
    return months;
  }, [selectedDate, transactions, locale, t]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'BRL' }).format(value);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">📊 {t('reports.title')}</h2>
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
        <MetricCard
          label={t('reports.variation')}
          value={`${summary.variation >= 0 ? '+' : ''}${summary.variation.toFixed(1)}%`}
          subtitle={`${summary.diff >= 0 ? '+' : ''}${formatCurrency(summary.diff)}`}
          icon={summary.variation >= 0 ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
          variant={summary.variation >= 0 ? 'primary' : 'warning'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart - Top 5 */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">{t('reports.expensesByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={90}
                    dataKey="value"
                  >
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

        {/* Bar Chart - 3 months */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">{t('reports.threeMonthComparison')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`} width={60} />
                <Tooltip formatter={v => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey={t('reports.income')} fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey={t('reports.expenses')} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Categories */}
      <Card className="backdrop-blur-sm bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t('reports.topCategories')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topCategories.length > 0 ? (
            <div className="space-y-3">
              {topCategories.map((cat, i) => (
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

      {/* Insights */}
      {currentTx.length > 0 && (
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

      {currentTx.length === 0 && (
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
