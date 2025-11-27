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

export function PlansSection() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

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
        setPlans(data?.slice(0, 3) || []);
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
    ];
  };

  const getPlanPrice = (plan: SubscriptionPlan) => {
    if (plan.role === 'free' || plan.role === 'trial') {
      return 'Grátis';
    }
    
    if (plan.price_monthly) {
      return `R$ ${plan.price_monthly.toFixed(2).replace('.', ',')}/mês`;
    }
    
    return 'Consulte';
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.role === 'free') {
      navigate('/cadastro');
    } else {
      navigate('/choose-plan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {plans.map((plan) => {
        const Icon = getPlanIcon(plan.role);
        const isPremium = plan.role === 'premium';
        
        return (
          <Card 
            key={plan.id} 
            className={`relative ${isPremium ? 'border-2 border-primary shadow-lg' : ''}`}
          >
            {isPremium && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                Mais popular
              </div>
            )}
            
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-6 w-6 ${isPremium ? 'text-primary' : 'text-muted-foreground'}`} />
                <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
              </div>
              <CardDescription className="min-h-[40px]">
                {plan.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div>
                <div className="text-4xl font-bold text-foreground">
                  {getPlanPrice(plan)}
                </div>
                {plan.price_monthly && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Cobrado mensalmente
                  </p>
                )}
              </div>

              <ul className="space-y-3">
                {getPlanFeatures(plan).map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check 
                      className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                        feature.available ? 'text-green-500' : 'text-muted-foreground'
                      }`} 
                    />
                    <span className={feature.available ? 'text-foreground' : 'text-muted-foreground line-through'}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full"
                variant={isPremium ? 'default' : 'outline'}
                size="lg"
                onClick={() => handleSelectPlan(plan)}
              >
                Escolher {plan.display_name}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
