import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/useTransactions";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Target, Download, Share } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export function ReportsPage() {
  const [period, setPeriod] = useState("month");
  const { transactions, categories } = useTransactions();

  const filteredData = useMemo(() => {
    if (!transactions) return { transactions: [], summary: { income: 0, expenses: 0, profit: 0 } };

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (period) {
      case "week":
        startDate = startOfWeek(now, { locale: ptBR });
        endDate = endOfWeek(now, { locale: ptBR });
        break;
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case "last7":
        startDate = subDays(now, 7);
        break;
      case "last30":
        startDate = subDays(now, 30);
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    const filtered = transactions.filter(t => {
      const transactionDate = parseISO(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      transactions: filtered,
      summary: {
        income,
        expenses,
        profit: income - expenses
      }
    };
  }, [transactions, period]);

  const chartData = useMemo(() => {
    const categoryMap = new Map<string, { name: string; receitas: number; despesas: number }>();
    
    filteredData.transactions.forEach(transaction => {
      const category = categories?.find(c => c.id === transaction.category_id);
      const categoryName = category?.name || 'Sem Categoria';
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          name: categoryName,
          receitas: 0,
          despesas: 0
        });
      }
      
      const existing = categoryMap.get(categoryName)!;
      if (transaction.type === 'income') {
        existing.receitas += Number(transaction.amount);
      } else {
        existing.despesas += Number(transaction.amount);
      }
    });

    return Array.from(categoryMap.values());
  }, [filteredData.transactions, categories]);

  const expenseDataForPie = useMemo(() => {
    const categoryMap = new Map<string, number>();
    
    filteredData.transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const category = categories?.find(c => c.id === transaction.category_id);
        const categoryName = category?.name || 'Sem Categoria';
        
        const current = categoryMap.get(categoryName) || 0;
        categoryMap.set(categoryName, current + Number(transaction.amount));
      });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value
    }));
  }, [filteredData.transactions, categories]);

  const incomeDataForPie = useMemo(() => {
    const categoryMap = new Map<string, number>();
    
    filteredData.transactions
      .filter(t => t.type === 'income')
      .forEach(transaction => {
        const category = categories?.find(c => c.id === transaction.category_id);
        const categoryName = category?.name || 'Sem Categoria';
        
        const current = categoryMap.get(categoryName) || 0;
        categoryMap.set(categoryName, current + Number(transaction.amount));
      });

    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value
    }));
  }, [filteredData.transactions, categories]);

  const dailyData = useMemo(() => {
    const dailyMap = new Map();
    
    filteredData.transactions.forEach(transaction => {
      const date = transaction.date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, income: 0, expenses: 0 });
      }
      
      const day = dailyMap.get(date);
      if (transaction.type === 'income') {
        day.income += Number(transaction.amount);
      } else {
        day.expenses += Number(transaction.amount);
      }
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData.transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "week": return "Esta Semana";
      case "month": return "Este Mês";
      case "year": return "Este Ano";
      case "last7": return "Últimos 7 dias";
      case "last30": return "Últimos 30 dias";
      default: return "Este Mês";
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Relatórios Financeiros</h2>
        <div className="flex items-center space-x-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="year">Este Ano</SelectItem>
              <SelectItem value="last7">Últimos 7 dias</SelectItem>
              <SelectItem value="last30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            <Share className="h-4 w-4 mr-2" />
            Compartilhar
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Receitas</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(filteredData.summary.income)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Despesas</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(filteredData.summary.expenses)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${filteredData.summary.profit >= 0 ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-orange-50 to-orange-100 border-orange-200'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${filteredData.summary.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {filteredData.summary.profit >= 0 ? 'Lucro' : 'Prejuízo'}
                </p>
                <p className={`text-2xl font-bold ${filteredData.summary.profit >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {formatCurrency(Math.abs(filteredData.summary.profit))}
                </p>
              </div>
              <DollarSign className={`h-8 w-8 ${filteredData.summary.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Transações</p>
                <p className="text-2xl font-bold text-purple-700">
                  {filteredData.transactions.length}
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Evolução Diária */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Diária - {getPeriodLabel()}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => format(parseISO(value), 'dd/MM')} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip labelFormatter={(value) => format(parseISO(value), 'dd/MM/yyyy')} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" name="Receitas" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Despesas" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle>Receitas vs Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pizza de Receitas */}
        {incomeDataForPie.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Receitas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeDataForPie}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {incomeDataForPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Pizza de Despesas */}
        {expenseDataForPie.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseDataForPie}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expenseDataForPie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Insights e Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle>Insights e Recomendações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredData.summary.profit < 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-semibold text-red-700">⚠️ Atenção: Prejuízo identificado</h4>
                <p className="text-red-600">
                  Suas despesas estão {formatCurrency(Math.abs(filteredData.summary.profit))} acima das receitas neste período. 
                  Considere revisar seus gastos ou aumentar sua renda.
                </p>
              </div>
            )}
            
            {filteredData.summary.profit > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-semibold text-green-700">✅ Parabéns: Resultado positivo!</h4>
                <p className="text-green-600">
                  Você teve um lucro de {formatCurrency(filteredData.summary.profit)} neste período. 
                  Considere investir esse valor ou criar uma reserva de emergência.
                </p>
              </div>
            )}

            {filteredData.transactions.length === 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-700">📊 Sem dados para o período</h4>
                <p className="text-blue-600">
                  Não há transações registradas para o período selecionado. 
                  Adicione algumas transações para visualizar relatórios detalhados.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}