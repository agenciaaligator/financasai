import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Transaction } from '@/hooks/useTransactions';

interface FinancialChartProps {
  transactions: Transaction[];
}

const COLORS = {
  income: '#10b981',
  expense: '#ef4444'
};

export function FinancialChart({ transactions }: FinancialChartProps) {
  // Dados para o gráfico de pizza (receitas vs despesas)
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const pieData = [
    {
      name: 'Receitas',
      value: totalIncome,
      color: COLORS.income
    },
    {
      name: 'Despesas', 
      value: totalExpenses,
      color: COLORS.expense
    }
  ];

  // Dados para o gráfico de barras por categoria
  const categoryData = transactions.reduce((acc, transaction) => {
    const categoryName = transaction.categories?.name || 'Sem categoria';
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
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey === 'income' ? 'Receita' : 'Despesa'}: R$ ${entry.value.toLocaleString('pt-BR')}`}
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
        <p>Adicione transações para ver os gráficos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de Pizza - Receitas vs Despesas */}
      <div>
        <h3 className="text-lg font-medium mb-4">Receitas vs Despesas</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de Barras por Categoria */}
      <div>
        <h3 className="text-lg font-medium mb-4">Por Categoria</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
            <Bar dataKey="income" fill={COLORS.income} name="Receita" />
            <Bar dataKey="expense" fill={COLORS.expense} name="Despesa" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}