import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Transaction } from '@/hooks/useTransactions';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/formatCurrency';
import { PieChart as PieChartIcon } from 'lucide-react';

interface FinancialChartProps {
  transactions: Transaction[];
}

const COLORS = {
  income: '#27AE60',
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

  const total = totalIncome + totalExpenses;

  const pieData = [
    { name: t('dashboard.income', 'Receitas'), value: totalIncome, color: COLORS.income },
    { name: t('dashboard.expenses', 'Despesas'), value: totalExpenses, color: COLORS.expense }
  ];

  if (transactions.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <PieChartIcon className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-sm">{t('chart.addTransactions', 'Adicione transações para ver os gráficos')}</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-background p-2 border border-border rounded-lg shadow-lg text-xs">
          <p className="font-medium" style={{ color: entry.payload.color }}>
            {`${entry.name}: ${formatCurrency(entry.value)} (${percentage}%)`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={4}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 text-xs ml-2">
        {pieData.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-medium text-foreground">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
