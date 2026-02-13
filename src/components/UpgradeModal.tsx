import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Sparkles, Crown, Gift } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useCheckout } from "@/hooks/useCheckout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getCurrencyFromLocale, formatPrice as formatCurrencyPrice } from "@/config/pricing";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { i18n } = useTranslation();
  const currency = getCurrencyFromLocale(i18n.language);
  const { planName, isFreePlan, isTrial, isPremium, refetch } = useSubscription();
  const { createCheckoutSession, loading } = useCheckout();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });
        
        if (error) throw error;
        setDbPlans(data || []);
      } catch (error) {
        console.error('Error fetching plans:', error);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  const handleStartTrial = async () => {
    setActivatingTrial(true);
    try {
      const { data, error } = await supabase.functions.invoke('activate-trial');
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({
        title: "Trial ativado!",
        description: "Aproveite 14 dias grátis do plano Premium 🎉",
      });
      
      await refetch();
      onClose();
    } catch (error) {
      console.error('Error activating trial:', error);
      toast({
        title: "Erro ao ativar trial",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setActivatingTrial(false);
    }
  };

  const plans = loadingPlans ? [] : dbPlans.map(plan => {
    const isPlanActive = planName === plan.name;
    const isTrialPlan = plan.role === 'trial';
    const isFreePlanRole = plan.role === 'free';
    const isPremiumPlan = plan.role === 'premium';
    
    return {
      name: plan.name,
      displayName: plan.display_name,
      icon: isFreePlanRole ? Gift : isTrialPlan ? Sparkles : Crown,
      // TODO: multi-currency priceIds from DB — currently DB plans are BRL only
      price: isFreePlanRole ? formatCurrencyPrice(0, currency) : isTrialPlan ? 'Grátis' : formatCurrencyPrice((selectedCycle === 'monthly' ? plan.price_monthly : (plan.price_yearly || 0) / 12) || 0, currency),
      period: isFreePlanRole ? 'para sempre' : isTrialPlan ? '14 dias' : selectedCycle === 'monthly' ? 'por mês' : 'por mês',
      yearlyPrice: isPremiumPlan && selectedCycle === 'yearly' ? `${formatCurrencyPrice(plan.price_yearly || 0, currency)}/ano` : undefined,
      yearlySavings: isPremiumPlan && selectedCycle === 'yearly' ? '💰 Economize 40%' : undefined,
      badge: isTrialPlan ? '🎁 Teste Grátis' : isPremiumPlan ? '⭐ Mais Popular' : undefined,
      features: [
        { name: plan.max_transactions ? `${plan.max_transactions} transações` : '✨ Transações ilimitadas', available: true },
        { name: plan.max_categories ? `${plan.max_categories} categorias` : '✨ Categorias ilimitadas', available: true },
        { name: 'WhatsApp', available: plan.has_whatsapp || false },
        { name: 'IA Reports', available: plan.has_ai_reports || false },
        { name: 'Google Calendar', available: plan.has_google_calendar || false },
        { name: 'Suporte prioritário', available: isPremiumPlan },
      ],
      buttonText: isPlanActive ? 'Plano Atual' : isTrialPlan && (isFreePlan || !isTrial) ? 'Começar Trial' : 'Assinar',
      buttonAction: isPlanActive 
        ? undefined 
        : isTrialPlan && (isFreePlan || !isTrial)
          ? handleStartTrial
          : () => {
              const priceId = selectedCycle === 'monthly' 
                ? plan.stripe_price_id_monthly 
                : plan.stripe_price_id_yearly;
              
              if (!priceId) {
                toast({
                  title: "❌ Erro",
                  description: "Plano não configurado. Contate o suporte.",
                  variant: "destructive"
                });
                return;
              }
              
              createCheckoutSession(priceId);
            },
      disabled: isPlanActive || (isTrialPlan && isTrial),
      planData: plan,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolha seu Plano</DialogTitle>
          <DialogDescription>
            {reason || "Desbloqueie todos os recursos e maximize seu potencial"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Por que escolher nosso sistema?</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ Gestão financeira completa e intuitiva</li>
              <li>✓ Integração com WhatsApp para facilitar seu dia a dia</li>
              <li>✓ Relatórios inteligentes com IA</li>
              <li>✓ Sincronização com Google Calendar</li>
            </ul>
          </div>

          {plans.some(p => p.planData.role === 'premium') && (
            <div className="flex justify-center">
              <div className="inline-flex rounded-lg border border-border p-1 bg-background">
                <button
                  onClick={() => setSelectedCycle('monthly')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    selectedCycle === 'monthly'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setSelectedCycle('yearly')}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    selectedCycle === 'yearly'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Anual
                  <span className="ml-2 text-xs">(-40%)</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card 
                  key={plan.name}
                  className={`relative ${
                    plan.badge?.includes('Popular')
                      ? 'border-primary shadow-lg'
                      : 'border-border'
                  }`}
                >
                  {plan.badge && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                      {plan.badge}
                    </Badge>
                  )}

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-6 w-6 text-primary" />
                      <h3 className="text-xl font-semibold">{plan.displayName}</h3>
                    </div>

                    <div>
                      <div className="text-3xl font-bold">{plan.price}</div>
                      <div className="text-sm text-muted-foreground">{plan.period}</div>
                      {plan.yearlyPrice && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {plan.yearlyPrice}
                        </div>
                      )}
                      {plan.yearlySavings && (
                        <Badge variant="secondary" className="mt-2">
                          {plan.yearlySavings}
                        </Badge>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          {feature.available ? (
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          )}
                          <span className={feature.available ? 'text-foreground' : 'text-muted-foreground'}>
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={plan.buttonAction}
                      disabled={plan.disabled || loading || activatingTrial}
                      className="w-full"
                      variant={plan.badge?.includes('Popular') ? 'default' : 'outline'}
                    >
                      {plan.buttonText}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Cupons e descontos são aplicados diretamente no checkout do Stripe
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
