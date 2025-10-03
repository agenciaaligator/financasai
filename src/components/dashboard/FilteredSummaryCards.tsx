import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Tag } from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { useMemo } from "react";

interface FilteredSummaryCardsProps {
  transactions: Transaction[];
}

export function FilteredSummaryCards({ transactions }: FilteredSummaryCardsProps) {
  const summary = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expenses;

    // Top 3 categorias mais usadas
    const categoryCount = transactions.reduce((acc, transaction) => {
      if (transaction.category_id && transaction.categories) {
        const categoryName = transaction.categories.name;
        acc[categoryName] = (acc[categoryName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return {
      balance,
      income,
      expenses,
      topCategories,
      transactionCount: transactions.length
    };
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo do Período</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
            R$ {summary.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.transactionCount} transações
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receitas</CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">
            R$ {summary.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total recebido
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Despesas</CardTitle>
          <TrendingDown className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            R$ {summary.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total gasto
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Categorias</CardTitle>
          <Tag className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {summary.topCategories.length > 0 ? (
              summary.topCategories.map((cat, idx) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate flex-1">
                    {idx + 1}. {cat.name}
                  </span>
                  <span className="font-medium ml-2">{cat.count}x</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">Sem categorias</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
