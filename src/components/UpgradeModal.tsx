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

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { planName, isFreePlan, isTrial, isPremium, refetch } = useSubscription();
  const { createCheckoutSession, loading } = useCheckout();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Buscar planos do banco de dados
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

  // Construir planos dinamicamente do banco de dados
  const plans = loadingPlans ? [] : dbPlans.map(plan => {
    const isPlanActive = planName === plan.name;
    const isTrialPlan = plan.role === 'trial';
    const isFreePlanRole = plan.role === 'free';
    const isPremiumPlan = plan.role === 'premium';
    
    return {
      name: plan.name,
      displayName: plan.display_name,
      icon: isFreePlanRole ? Gift : isTrialPlan ? Sparkles : Crown,
      price: isFreePlanRole ? 'R$ 0' : isTrialPlan ? 'Grátis' : `R$ ${(selectedCycle === 'monthly' ? plan.price_monthly : (plan.price_yearly || 0) / 12)?.toFixed(2)}`,
      period: isFreePlanRole ? 'para sempre' : isTrialPlan ? '14 dias' : selectedCycle === 'monthly' ? 'por mês' : 'por mês',
      yearlyPrice: isPremiumPlan && selectedCycle === 'yearly' ? `R$ ${plan.price_yearly?.toFixed(2)}/ano` : undefined,
      yearlySavings: isPremiumPlan && selectedCycle === 'yearly' ? '💰 Economize 40%' : undefined,
      badge: isTrialPlan ? '🎁 Teste Grátis' : isPremiumPlan ? '⭐ Mais Popular' : undefined,
      features: [
        { name: plan.max_transactions ? `${plan.max_transactions} transações` : '✨ Transações ilimitadas', available: true },
        { name: plan.max_categories ? `${plan.max_categories} categorias` : '✨ Categorias ilimitadas', available: true },
        { name: 'WhatsApp', available: plan.has_whatsapp || false },
        { name: 'IA Reports', available: plan.has_ai_reports || false },
        { name: 'Google Calendar', available: plan.has_google_calendar || false },
        { name: 'Integração bancária', available: plan.has_bank_integration || false },
        { name: 'Multi-usuário', available: plan.has_multi_user || false },
        { name: 'Suporte prioritário', available: plan.has_priority_support || false }
      ],
      buttonText: isPlanActive ? 'Plano Atual' : isTrialPlan ? 'Começar Trial Grátis' : 'Assinar Agora',
      variant: isFreePlanRole ? 'outline' as const : isTrialPlan ? 'secondary' as const : 'default' as const,
      highlight: isPremiumPlan,
      disabled: isPlanActive,
      current: isPlanActive,
      onButtonClick: isTrialPlan ? handleStartTrial : isPremiumPlan ? async () => await createCheckoutSession(selectedCycle) : undefined
    };
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Escolha seu Plano
          </DialogTitle>
          {reason && (
            <DialogDescription className="text-base">
              {reason}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Competitive Advantages Section */}
        <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-lg mb-3">🚀 Por que escolher FinançasAI?</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-lg">✓</span>
              <span>WhatsApp com IA integrada</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-lg">✓</span>
              <span>Relatórios Inteligentes (GPT-4)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-lg">✓</span>
              <span>Integração bancária automática</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-lg">✓</span>
              <span>Multi-usuário</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-lg">✓</span>
              <span>14 dias de trial grátis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-lg">✓</span>
              <span>Suporte prioritário</span>
            </div>
          </div>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-4 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setSelectedCycle('monthly')}
              className={`px-6 py-2 rounded-md transition-colors font-medium ${
                selectedCycle === 'monthly'
                  ? 'bg-background shadow-sm'
                  : 'hover:bg-background/50'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setSelectedCycle('yearly')}
              className={`px-6 py-2 rounded-md transition-colors font-medium relative ${
                selectedCycle === 'yearly'
                  ? 'bg-background shadow-sm'
                  : 'hover:bg-background/50'
              }`}
            >
              Anual
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                -40%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card 
                key={plan.name} 
                className={`relative p-6 ${
                  plan.highlight 
                    ? 'border-2 border-primary shadow-lg shadow-primary/20' 
                    : 'border'
                } ${plan.current ? 'bg-muted/50' : ''}`}
              >
                {plan.badge && (
                  <Badge 
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                    variant={plan.highlight ? "default" : "secondary"}
                  >
                    {plan.badge}
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <Icon className={`h-12 w-12 mx-auto mb-3 ${
                    plan.highlight ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <h3 className="text-xl font-bold mb-2">{plan.displayName}</h3>
                  <div className="mb-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.period}</p>
                  {plan.yearlyPrice && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">{plan.yearlyPrice}</p>
                      <p className="text-xs text-success">{plan.yearlySavings}</p>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      {feature.available ? (
                        <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm ${
                        feature.available ? '' : 'text-muted-foreground line-through'
                      }`}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.variant}
                  disabled={plan.disabled || loading || (plan.name === 'trial' && activatingTrial)}
                  onClick={async () => {
                    if (plan.name === 'premium' && !isPremium) {
                      const priceId = selectedCycle === 'monthly' 
                        ? 'price_1SFTZoJH1fRNsXz1EJc3R0yl'  // R$ 49,90/mês
                        : 'price_1SFTaPJH1fRNsXz1pn1ZpzSW'; // R$ 358,80/ano
                      await createCheckoutSession(priceId);
                    } else if (plan.name === 'trial' && plan.onButtonClick) {
                      await plan.onButtonClick();
                    }
                  }}
                >
                  {plan.name === 'trial' && activatingTrial ? 'Ativando...' : 
                   loading ? 'Processando...' : 
                   plan.buttonText}
                </Button>

                {plan.current && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Seu plano atual
                  </p>
                )}
              </Card>
            );
          })}
        </div>

        <div className="text-center text-sm text-muted-foreground mt-4">
          <p>Pagamento seguro • Cancele quando quiser • Sem compromisso</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
