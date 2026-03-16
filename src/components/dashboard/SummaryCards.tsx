import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatCurrency";

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
}

export function SummaryCards({ balance, totalIncome, totalExpenses }: SummaryCardsProps) {
  const isNegative = balance < 0;
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="relative dw-card bg-card shadow-card border-0 animate-fadeInUp">
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-[20px]"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-6">
          <CardTitle className="text-xs uppercase tracking-wider font-medium text-muted-foreground">{t('summary.monthBalance', 'Saldo do Mês')}</CardTitle>
          <div className="w-[60px] h-[60px] bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-xl sm:text-[2rem] font-bold ${isNegative ? 'text-destructive' : 'text-success'}`}>
            {formatCurrency(balance)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t('summary.balanceSubtitle', 'Receitas menos despesas deste mês')}
          </p>
        </CardContent>
      </Card>

      <Card className="relative dw-card bg-card shadow-card border-0 animate-fadeInUp delay-100">
        <div className="absolute top-0 left-0 right-0 h-1 bg-success rounded-t-[20px]"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-6">
          <CardTitle className="text-xs uppercase tracking-wider font-medium text-muted-foreground">{t('dashboard.income', 'Receitas')}</CardTitle>
          <div className="w-[60px] h-[60px] bg-gradient-to-br from-success to-success/80 rounded-full flex items-center justify-center">
            <span className="text-2xl">📈</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-[2rem] font-bold text-success">
            R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t('summary.incomeSubtitle', 'Total recebido este mês')}
          </p>
        </CardContent>
      </Card>

      <Card className="relative dw-card bg-card shadow-card border-0 animate-fadeInUp delay-200">
        <div className="absolute top-0 left-0 right-0 h-1 bg-destructive rounded-t-[20px]"></div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-6">
          <CardTitle className="text-xs uppercase tracking-wider font-medium text-muted-foreground">{t('dashboard.expenses', 'Despesas')}</CardTitle>
          <div className="w-[60px] h-[60px] bg-gradient-to-br from-destructive to-destructive/80 rounded-full flex items-center justify-center">
            <span className="text-2xl">📉</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-[2rem] font-bold text-destructive">
            R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t('summary.expensesSubtitle', 'Total gasto este mês')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
