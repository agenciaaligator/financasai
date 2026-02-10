import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Transaction } from '@/hooks/useTransactions';
import { useTranslation } from 'react-i18next';

interface FinancialChartProps {
  transactions: Transaction[];
}

const COLORS = {
  income: '#059669',
  expense: '#dc2626'
};

export function FinancialChart({ transactions }: FinancialChartProps) {
  const { t } = useTranslation();

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const pieData = [
    { name: t('dashboard.income', 'Receitas'), value: totalIncome, color: COLORS.income },
    { name: t('dashboard.expenses', 'Despesas'), value: totalExpenses, color: COLORS.expense }
  ];

  const categoryData = transactions.reduce((acc, transaction) => {
    const categoryName = transaction.categories?.name || t('chart.noCategory', 'Sem Categoria');
    const existing = acc.find(item => item.category === categoryName);
    if (existing) {
      if (transaction.type === 'income') {
        existing.income += transaction.amount;
      } else {
        existing.expense += transaction.amount;
      }
    } else {
      acc.push({
        category: categoryName,
        income: transaction.type === 'income' ? transaction.amount : 0,
        expense: transaction.type === 'expense' ? transaction.amount : 0
      });
    }
    return acc;
  }, [] as Array<{ category: string; income: number; expense: number; }>);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium text-foreground">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey === 'income' ? t('dashboard.income', 'Receita') : t('dashboard.expenses', 'Despesa')}: R$ ${entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{t('chart.addTransactions', 'Adicione transações para ver os gráficos')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">{t('chart.incomeVsExpenses', 'Receitas vs Despesas')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
            />
            <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '16px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">{t('chart.byCategory', 'Por Categoria')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="category" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR', { notation: 'compact' })}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="income" fill={COLORS.income} name={t('dashboard.income', 'Receita')} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill={COLORS.expense} name={t('dashboard.expenses', 'Despesa')} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
