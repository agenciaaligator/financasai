import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, Tag, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Stripe Price IDs (hardcoded - managed in Stripe Dashboard)
const STRIPE_PRICES = {
  monthly: 'price_1SFTA4JH1fRNsXz1VdkYkfEg', // R$ 29,90/mês
  yearly: 'price_1SFTBQJH1fRNsXz1MXPjabkC',  // R$ 299,00/ano
} as const;

export default function ChoosePlan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Preços fixos (gerenciados no Stripe)
  const monthlyPrice = 29.90;
  const yearlyPrice = 299.00;
  const yearlyMonthlyEquivalent = yearlyPrice / 12;
  const savings = Math.round(((monthlyPrice - yearlyMonthlyEquivalent) / monthlyPrice) * 100);

  const handleCheckout = async () => {
    setIsLoading(true);
    
    try {
      toast({
        title: "🔄 Redirecionando para checkout...",
        description: "Aguarde enquanto preparamos seu pagamento",
      });

      const priceId = STRIPE_PRICES[cycle];
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId,
          couponCode: couponCode.trim() || undefined,
        },
      });

      if (error) {
        console.error('[CHECKOUT] Error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('URL de checkout não retornada');
      }

      console.log('[CHECKOUT] Redirecting to:', data.url);
      window.location.href = data.url;
      
    } catch (error) {
      console.error('[CHECKOUT] Error:', error);
      toast({
        title: "❌ Erro ao criar checkout",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const displayPrice = cycle === 'monthly' ? monthlyPrice : yearlyMonthlyEquivalent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            Voltar
          </Button>
        </nav>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Escolha seu plano
          </h1>
          <p className="text-muted-foreground text-lg">
            Gerencie suas finanças e compromissos com inteligência artificial
          </p>
        </div>

        {/* Toggle Mensal/Anual */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border p-1 bg-muted/50">
            <Button
              variant={cycle === 'monthly' ? 'default' : 'ghost'}
              onClick={() => setCycle('monthly')}
              className="rounded-md"
            >
              Mensal
            </Button>
            <Button
              variant={cycle === 'yearly' ? 'default' : 'ghost'}
              onClick={() => setCycle('yearly')}
              className="rounded-md"
            >
              Anual
              <Badge variant="secondary" className="ml-2">
                Economize {savings}%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Card do Plano */}
        <Card className="border-2 border-primary shadow-xl mb-8">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-3xl">Premium</CardTitle>
              <Badge className="text-sm">Mais popular</Badge>
            </div>
            <CardDescription>
              Plano completo com todos os recursos
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">
                R$ {displayPrice.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            {cycle === 'yearly' && (
              <p className="text-sm text-muted-foreground">
                Cobrado anualmente: R$ {yearlyPrice.toFixed(2).replace('.', ',')}
              </p>
            )}

            <ul className="space-y-3">
              {[
                'Transações ilimitadas',
                'Categorias ilimitadas',
                'WhatsApp integrado',
                'Relatórios com IA',
                'Google Calendar',
                'Multi-usuário',
                'Suporte prioritário',
              ].map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Input de Cupom - Validado via Stripe */}
            <div className="pt-4 border-t">
              <Label htmlFor="coupon" className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4" />
                Tem um cupom de desconto?
              </Label>
              <Input
                id="coupon"
                placeholder="Digite o código (ex: AMIGOS2025)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-2">
                O cupom será validado automaticamente no checkout do Stripe
              </p>
            </div>

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
              Pagamento seguro via Stripe. Cancele quando quiser.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Ao continuar, você concorda com nossos termos de serviço
        </p>
      </div>
    </div>
  );
}
