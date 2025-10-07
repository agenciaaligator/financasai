import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Sparkles, Crown, Gift } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useCheckout } from "@/hooks/useCheckout";
import { useState } from "react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { planName, isFreePlan, isTrial, isPremium } = useSubscription();
  const { createCheckoutSession, loading } = useCheckout();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      name: 'free',
      displayName: 'Gratuito',
      icon: Gift,
      price: 'R$ 0',
      period: 'para sempre',
      features: [
        { name: '50 transações/mês', available: true },
        { name: '8 categorias', available: true },
        { name: 'Relatórios básicos', available: true },
        { name: 'WhatsApp', available: false },
        { name: 'IA Reports', available: false },
        { name: 'Transações ilimitadas', available: false },
        { name: 'Categorias ilimitadas', available: false },
        { name: 'Suporte prioritário', available: false }
      ],
      buttonText: 'Plano Atual',
      variant: 'outline' as const,
      disabled: true,
      current: isFreePlan
    },
    {
      name: 'trial',
      displayName: 'Trial',
      icon: Sparkles,
      price: 'Grátis',
      period: '14 dias',
      badge: 'Teste Grátis',
      features: [
        { name: '100 transações', available: true },
        { name: '15 categorias', available: true },
        { name: 'Relatórios avançados', available: true },
        { name: 'WhatsApp', available: true },
        { name: 'IA Reports', available: false },
        { name: 'Transações ilimitadas', available: false },
        { name: 'Categorias ilimitadas', available: false },
        { name: 'Suporte prioritário', available: false }
      ],
      buttonText: isTrial ? 'Plano Atual' : 'Começar Trial',
      variant: 'secondary' as const,
      disabled: isTrial,
      current: isTrial
    },
    {
      name: 'premium',
      displayName: 'Premium',
      icon: Crown,
      price: 'R$ 29,90',
      period: 'por mês',
      yearlyPrice: 'R$ 299/ano',
      yearlySavings: 'Economize R$ 59,80',
      badge: 'Mais Popular',
      features: [
        { name: 'Transações ilimitadas', available: true },
        { name: 'Categorias ilimitadas', available: true },
        { name: 'Relatórios avançados', available: true },
        { name: 'WhatsApp integrado', available: true },
        { name: 'IA Reports ilimitado', available: true },
        { name: 'Integração bancária', available: true },
        { name: 'Multi-usuário', available: true },
        { name: 'Suporte prioritário', available: true }
      ],
      buttonText: isPremium ? 'Plano Atual' : 'Assinar Agora',
      variant: 'default' as const,
      highlight: true,
      disabled: isPremium,
      current: isPremium
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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

        {!isFreePlan && !isTrial && (
          <div className="flex justify-center gap-4 mb-6">
            <Button
              variant={selectedCycle === 'monthly' ? 'default' : 'outline'}
              onClick={() => setSelectedCycle('monthly')}
              size="sm"
            >
              Mensal
            </Button>
            <Button
              variant={selectedCycle === 'yearly' ? 'default' : 'outline'}
              onClick={() => setSelectedCycle('yearly')}
              size="sm"
            >
              Anual (Economize 17%)
            </Button>
          </div>
        )}

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
                  disabled={plan.disabled || loading}
                  onClick={async () => {
                    if (plan.name === 'premium' && !isPremium) {
                      const priceId = selectedCycle === 'monthly' 
                        ? 'price_1SFTA4JH1fRNsXz1VdkYkfEg'
                        : 'price_1SFTBQJH1fRNsXz1MXPjabkC';
                      await createCheckoutSession(priceId);
                    }
                  }}
                >
                  {loading ? 'Processando...' : plan.buttonText}
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
