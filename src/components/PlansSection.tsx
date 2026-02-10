import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  STRIPE_PRICES, 
  DISPLAY_PRICES, 
  formatPrice, 
  calculateYearlySavings 
} from "@/config/pricing";

export function PlansSection() {
  const { toast } = useToast();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  const savings = calculateYearlySavings();

  const displayPrice = cycle === 'monthly' 
    ? DISPLAY_PRICES.monthly 
    : DISPLAY_PRICES.yearlyMonthlyEquivalent;

  const features = [
    'Transações ilimitadas',
    'Categorias ilimitadas',
    'WhatsApp integrado',
    'Classificação automática por IA',
    'Consultas financeiras por WhatsApp',
    'Suporte prioritário',
  ];

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      toast({
        title: "🔄 Redirecionando para checkout...",
        description: "Aguarde enquanto preparamos seu pagamento",
      });

      const priceId = STRIPE_PRICES[cycle];

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) {
        console.error('[CHECKOUT] Error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('URL de checkout não retornada');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('[CHECKOUT] Error:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível completar a ação. Tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Toggle Mensal/Anual */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg border p-1 bg-muted/50">
          <Button
            variant={cycle === 'monthly' ? 'default' : 'ghost'}
            onClick={() => setCycle('monthly')}
            className="rounded-md"
            size="sm"
          >
            Mensal
          </Button>
          <Button
            variant={cycle === 'yearly' ? 'default' : 'ghost'}
            onClick={() => setCycle('yearly')}
            className="rounded-md"
            size="sm"
          >
            Anual
            <Badge variant="secondary" className="ml-2">
              -{savings}%
            </Badge>
          </Button>
        </div>
      </div>

      {/* Card do Plano Premium */}
      <Card className="border-2 border-primary shadow-lg relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
          Mais popular
        </div>
        
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Premium</CardTitle>
          </div>
          <CardDescription>
            Plano completo com todos os recursos
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">
                {formatPrice(displayPrice)}
              </span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            {cycle === 'yearly' && (
              <p className="text-sm text-muted-foreground mt-1">
                Cobrado anualmente: {formatPrice(DISPLAY_PRICES.yearly)}
              </p>
            )}
          </div>

          <ul className="space-y-3">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          <Button 
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                Ir para pagamento
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            💡 Tem um cupom? Digite na tela de pagamento do Stripe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
