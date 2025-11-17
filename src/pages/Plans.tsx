import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Gift, Sparkles, Crown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  max_transactions: number | null;
  max_categories: number | null;
  has_whatsapp: boolean | null;
  has_ai_reports: boolean | null;
  has_google_calendar: boolean | null;
  role: 'free' | 'trial' | 'premium' | 'admin';
}

export const Plans = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const fetchPlans = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });
      
      if (error) {
        console.error('Error fetching plans:', error);
        toast({
          title: "Erro ao carregar planos",
          description: "Tente novamente mais tarde",
          variant: "destructive"
        });
      } else {
        setPlans(data || []);
      }
      setLoading(false);
    };

    fetchPlans();
  }, [toast]);

  const getPlanIcon = (role: string) => {
    switch (role) {
      case 'free': return Gift;
      case 'trial': return Sparkles;
      case 'premium': return Crown;
      default: return Gift;
    }
  };

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    return [
      { 
        name: plan.max_transactions 
          ? `${plan.max_transactions} transações` 
          : 'Transações ilimitadas', 
        available: true 
      },
      { 
        name: plan.max_categories 
          ? `${plan.max_categories} categorias` 
          : 'Categorias ilimitadas', 
        available: true 
      },
      { name: 'WhatsApp', available: plan.has_whatsapp || false },
      { name: 'Relatórios com IA', available: plan.has_ai_reports || false },
      { name: 'Google Calendar', available: plan.has_google_calendar || false },
      { name: 'Suporte prioritário', available: plan.role === 'premium' },
    ];
  };

  const getPlanPrice = (plan: SubscriptionPlan) => {
    if (plan.role === 'free' || plan.role === 'trial') {
      return 'Grátis';
    }
    
    if (selectedCycle === 'monthly' && plan.price_monthly) {
      return `R$ ${plan.price_monthly.toFixed(2).replace('.', ',')}/mês`;
    }
    
    if (selectedCycle === 'yearly' && plan.price_yearly) {
      const monthlyEquivalent = plan.price_yearly / 12;
      return `R$ ${monthlyEquivalent.toFixed(2).replace('.', ',')}/mês`;
    }
    
    return 'Consulte';
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    navigate(`/cadastro?plano=${plan.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Escolha seu Plano
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comece grátis e faça upgrade quando precisar de mais recursos
          </p>
        </div>

        {/* Cycle Toggle - Only show if premium plan exists */}
        {plans.some(p => p.role === 'premium') && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-lg border border-border bg-background p-1">
              <Button
                variant={selectedCycle === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCycle('monthly')}
                className="rounded-md"
              >
                Mensal
              </Button>
              <Button
                variant={selectedCycle === 'yearly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCycle('yearly')}
                className="rounded-md"
              >
                Anual
                <span className="ml-2 text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded">
                  -50%
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = getPlanIcon(plan.role);
            const features = getPlanFeatures(plan);
            const price = getPlanPrice(plan);
            const isPremium = plan.role === 'premium';

            return (
              <Card 
                key={plan.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                  isPremium ? 'border-primary shadow-primary/20 scale-105' : ''
                }`}
              >
                {isPremium && (
                  <div className="absolute top-0 right-0 bg-gradient-primary text-white px-3 py-1 text-xs font-semibold rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      isPremium ? 'bg-gradient-primary' : 'bg-primary/10'
                    }`}>
                      <Icon className={`h-6 w-6 ${isPremium ? 'text-white' : 'text-primary'}`} />
                    </div>
                    <CardTitle className="text-xl">{plan.display_name}</CardTitle>
                  </div>
                  <CardDescription>{plan.description || 'Plano completo'}</CardDescription>
                  <div className="mt-4">
                    <div className="text-3xl font-bold">{price}</div>
                    {plan.role === 'trial' && (
                      <p className="text-sm text-muted-foreground">por 14 dias</p>
                    )}
                    {selectedCycle === 'yearly' && plan.price_yearly && (
                      <p className="text-sm text-muted-foreground">
                        Cobrado R$ {plan.price_yearly.toFixed(2).replace('.', ',')} anualmente
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                          feature.available ? 'text-green-600' : 'text-muted-foreground/30'
                        }`} />
                        <span className={feature.available ? '' : 'text-muted-foreground/50'}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className={`w-full ${isPremium ? 'bg-gradient-primary hover:shadow-primary' : ''}`}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    Começar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground mb-4">
            Já tem uma conta?{" "}
            <Button 
              variant="link" 
              className="p-0 h-auto font-semibold text-primary"
              onClick={() => navigate('/')}
            >
              Faça login
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Plans;
