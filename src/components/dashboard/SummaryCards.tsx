import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, CheckCircle2, Calendar, ExternalLink, AlertTriangle, XCircle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SummaryCardsProps {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
}

export function SummaryCards({ balance, totalIncome, totalExpenses }: SummaryCardsProps) {
  const isNegative = balance < 0;
  const { isPremium } = useSubscription();
  const guard = useSubscriptionGuard();
  const [managingSubscription, setManagingSubscription] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  const currentMonthName = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('common.genericError'),
        variant: "destructive",
      });
    } finally {
      setManagingSubscription(false);
    }
  };

  // Subscription status display
  const getStatusConfig = () => {
    if (guard.isMasterOrAdmin) {
      return { label: t('summary.active', 'Ativo'), color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/50', icon: CheckCircle2, detail: t('summary.fullAccess', 'Acesso completo') };
    }
    switch (guard.subscriptionStatus) {
      case 'active':
        return { label: t('summary.active', 'Ativo'), color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/50', icon: CheckCircle2, detail: guard.subscriptionEndDate ? t('subscription.renewsAt', 'Renova em: {{date}}', { date: format(guard.subscriptionEndDate, 'dd/MM/yyyy') }) : t('summary.fullAccess') };
      case 'past_due':
        return { label: t('subscription.pastDue', 'Em atraso'), color: 'text-yellow-600', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/50', icon: AlertTriangle, detail: t('subscription.regularize', 'Regularizar agora') };
      case 'cancelled':
        return { label: t('subscription.cancelled', 'Cancelada'), color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/50', icon: XCircle, detail: guard.subscriptionEndDate ? t('subscription.expiresAt', 'Expira em: {{date}}', { date: format(guard.subscriptionEndDate, 'dd/MM/yyyy') }) : '' };
      default:
        return { label: t('subscription.inactive', 'Inativa'), color: 'text-muted-foreground', bgColor: 'bg-muted/10', borderColor: 'border-muted/50', icon: XCircle, detail: '' };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('summary.monthBalance', 'Saldo do Mês')}</CardTitle>
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
          <CardTitle className="text-sm font-medium">{t('dashboard.income', 'Receitas')}</CardTitle>
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
          <CardTitle className="text-sm font-medium">{t('dashboard.expenses', 'Despesas')}</CardTitle>
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
          <CardTitle className="text-sm font-medium">{t('subscription.status', 'Status da Assinatura')}</CardTitle>
          <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${statusConfig.borderColor} ${statusConfig.color} ${statusConfig.bgColor}`}>
              ● {statusConfig.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {statusConfig.detail}
          </p>
          
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-3"
            onClick={handleManageSubscription}
            disabled={managingSubscription}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            {managingSubscription ? t('common.loading', 'Carregando...') : t('subscription.manageSubscription', 'Gerenciar assinatura')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
