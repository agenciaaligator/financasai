import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown, Crown, Sparkles, Calendar } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
import { UpgradeModal } from "../UpgradeModal";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
}

export function SummaryCards({ balance, totalIncome, totalExpenses }: SummaryCardsProps) {
  const isNegative = balance < 0;
  const { planName, isFreePlan, isTrial, isPremium } = useSubscription();
  const { getTransactionProgress, getCategoryProgress } = useFeatureLimits();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const transactionProgress = getTransactionProgress();
  const categoryProgress = getCategoryProgress();

  // Nome do mês atual
  const currentMonthName = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-success'}`}>
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 mt-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{capitalizedMonth}</span>
          </div>
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
          <div className="flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{capitalizedMonth}</span>
          </div>
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
          <div className="flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{capitalizedMonth}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Meu Plano</CardTitle>
          {isPremium ? (
            <Crown className="h-4 w-4 text-primary" />
          ) : (
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{planName}</div>
          
          {transactionProgress && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Transações</span>
                <span className={transactionProgress.isNearLimit ? 'text-destructive font-medium' : ''}>
                  {transactionProgress.current}/{transactionProgress.limit}
                </span>
              </div>
              <Progress 
                value={transactionProgress.percentage} 
                className="h-1"
              />
            </div>
          )}

          {categoryProgress && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Categorias</span>
                <span className={categoryProgress.isNearLimit ? 'text-destructive font-medium' : ''}>
                  {categoryProgress.current}/{categoryProgress.limit}
                </span>
              </div>
              <Progress 
                value={categoryProgress.percentage} 
                className="h-1"
              />
            </div>
          )}

          {(isFreePlan || isTrial) && (
            <Button
              size="sm"
              className="w-full mt-3"
              onClick={() => setShowUpgradeModal(true)}
            >
              Upgrade
            </Button>
          )}
        </CardContent>
      </Card>
    </div>

    <UpgradeModal 
      open={showUpgradeModal} 
      onClose={() => setShowUpgradeModal(false)}
    />
    </>
  );
}