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
          <p className="text-xl text-muted-foreground">
            Selecione o plano ideal para suas necessidades
          </p>
        </div>

        {plans.some(p => p.role === 'premium') && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-lg border border-border p-1 bg-background">
              <button
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  selectedCycle === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setSelectedCycle('monthly')}
              >
                Mensal
              </button>
              <button
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  selectedCycle === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setSelectedCycle('yearly')}
              >
                Anual <span className="text-xs ml-1">(Economize até 20%)</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
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
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Mais Popular
                  </div>
                )}
                
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                  <CardDescription className="mt-2">
                    {plan.description || 'Plano completo para suas necessidades'}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-foreground">
                      {getPlanPrice(plan)}
                    </div>
                    {plan.role !== 'free' && plan.role !== 'trial' && selectedCycle === 'yearly' && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Cobrado anualmente
                      </div>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check 
                          className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${
                            feature.available 
                              ? 'text-primary' 
                              : 'text-muted-foreground/30'
                          }`} 
                        />
                        <span className={feature.available ? 'text-foreground' : 'text-muted-foreground/50'}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full ${
                      isPopular
                        ? 'bg-primary hover:bg-primary/90'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    Escolher {plan.display_name}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Já tem uma conta?
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Fazer login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Plans;
