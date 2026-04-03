import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatCurrency";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  sparklineData?: { income: number[]; expense: number[]; balance: number[] };
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <div className="h-[30px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SummaryCards({ balance, totalIncome, totalExpenses, sparklineData }: SummaryCardsProps) {
  const isNegative = balance < 0;
  const { t } = useTranslation();

  const cards = [
    {
      title: t('summary.monthBalance', 'Saldo do Mês'),
      value: balance,
      color: isNegative ? 'hsl(var(--destructive))' : 'hsl(var(--success))',
      textClass: isNegative ? 'text-destructive' : 'text-success',
      icon: Wallet,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      accent: 'border-t-2 border-t-primary',
      sparkline: sparklineData?.balance,
    },
    {
      title: t('dashboard.income', 'Receitas'),
      value: totalIncome,
      color: 'hsl(var(--success))',
      textClass: 'text-success',
      icon: TrendingUp,
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      accent: 'border-t-2 border-t-success',
      sparkline: sparklineData?.income,
    },
    {
      title: t('dashboard.expenses', 'Despesas'),
      value: totalExpenses,
      color: 'hsl(var(--destructive))',
      textClass: 'text-destructive',
      icon: TrendingDown,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
      accent: 'border-t-2 border-t-destructive',
      sparkline: sparklineData?.expense,
    },
  ];

  return (
    <>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <Card key={i} className={`${card.accent} border-0 shadow-sm`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  {card.title}
                </span>
                <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </div>
              <div className={`text-xl sm:text-2xl font-bold ${card.textClass}`}>
                {formatCurrency(card.value)}
              </div>
              <MiniSparkline data={card.sparkline || []} color={card.color} />
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
