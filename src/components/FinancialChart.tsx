import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Transaction } from '@/hooks/useTransactions';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/formatCurrency';

interface FinancialChartProps {
  transactions: Transaction[];
}

const COLORS = {
  income: '#27AE60', // Verde natural
  expense: '#dc2626'  // Vermelho para despesas
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
      <div className="text-center py-8 text-muted-foreground">
        <p>{t('chart.addTransactions', 'Adicione transações para ver os gráficos')}</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
      return (
        <div className="bg-background p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium text-foreground" style={{ color: entry.payload.color }}>
            {`${entry.name}: R$ ${entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentage}%)`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h3 className="font-heading text-lg font-medium mb-4">{t('chart.howIsYourMoney', 'Como seu dinheiro se comportou')}</h3>
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
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '16px', paddingTop: '20px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
