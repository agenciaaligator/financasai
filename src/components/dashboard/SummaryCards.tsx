import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
}

export function SummaryCards({ balance, totalIncome, totalExpenses }: SummaryCardsProps) {
  const isNegative = balance < 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-success'}`}>
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <Badge variant={isNegative ? "destructive" : "default"} className="mt-2">
            {isNegative ? 'Negativo' : 'Positivo'}
          </Badge>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receitas</CardTitle>
          <TrendingUp className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">
            R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            Este mês
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
            R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            Este mês
          </p>
        </CardContent>
      </Card>
    </div>
  );
}