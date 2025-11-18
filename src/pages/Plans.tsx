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
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Escolha seu plano
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comece grátis e faça upgrade quando precisar de mais recursos
          </p>
        </div>

        {plans.some(p => p.role === 'premium') && (
          <div className="flex justify-center mb-8">
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

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const Icon = getPlanIcon(plan.role);
            const features = getPlanFeatures(plan);
            const isPopular = plan.role === 'premium';

            return (
              <Card 
                key={plan.id}
                className={`relative ${
                  isPopular 
                    ? 'border-primary shadow-lg scale-105' 
                    : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      Mais Popular
                    </span>
                  </div>
                )}
                
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                  </div>
                  {plan.description && (
                    <CardDescription>{plan.description}</CardDescription>
                  )}
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">
                      {getPlanPrice(plan)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check 
                          className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                            feature.available 
                              ? 'text-primary' 
                              : 'text-muted-foreground'
                          }`}
                        />
                        <span className={
                          feature.available 
                            ? 'text-foreground' 
                            : 'text-muted-foreground'
                        }>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                  >
                    Começar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-muted-foreground mb-2">
            Já tem uma conta?
          </p>
          <Button
            variant="link"
            onClick={() => navigate('/')}
            className="text-primary"
          >
            Fazer login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Plans;
