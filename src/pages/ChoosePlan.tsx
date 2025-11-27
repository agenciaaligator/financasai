import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, Tag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ChoosePlan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponValid, setCouponValid] = useState(false);
  const [couponError, setCouponError] = useState('');

  const monthlyPrice = 29.90;
  const yearlyPrice = 238.80;
  const yearlyMonthlyEquivalent = yearlyPrice / 12;
  const savings = Math.round(((monthlyPrice - yearlyMonthlyEquivalent) / monthlyPrice) * 100);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Digite um código de cupom');
      return;
    }

    setValidatingCoupon(true);
    setCouponError('');

    try {
      const { data, error } = await supabase
        .from('discount_coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCouponError('Cupom inválido ou expirado');
        setCouponValid(false);
        return;
      }

      // Verificar expiração
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setCouponError('Este cupom expirou');
        setCouponValid(false);
        return;
      }

      // Verificar limite de uso
      if (data.max_uses && data.current_uses && data.current_uses >= data.max_uses) {
        setCouponError('Este cupom atingiu o limite de uso');
        setCouponValid(false);
        return;
      }

      setCouponValid(true);
      toast({
        title: "✅ Cupom válido!",
        description: data.type === 'full_access' 
          ? "30 dias grátis serão aplicados após criar sua conta" 
          : `Desconto de ${data.value}${data.type === 'percentage' ? '%' : ' reais'} será aplicado`,
      });
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError('Erro ao validar cupom');
      setCouponValid(false);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleContinue = () => {
    const params = new URLSearchParams({
      plan: 'premium',
      cycle,
    });

    if (couponValid && couponCode) {
      params.append('coupon', couponCode.toUpperCase());
    }

    navigate(`/cadastro?${params.toString()}`);
  };

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
                R$ {cycle === 'monthly' 
                  ? monthlyPrice.toFixed(2).replace('.', ',')
                  : yearlyMonthlyEquivalent.toFixed(2).replace('.', ',')}
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

            {/* Input de Cupom */}
            <div className="pt-4 border-t">
              <Label htmlFor="coupon" className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4" />
                Tem um cupom de desconto?
              </Label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  placeholder="Digite o código"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponError('');
                    setCouponValid(false);
                  }}
                  className={couponValid ? 'border-green-500' : couponError ? 'border-red-500' : ''}
                />
                <Button
                  variant="outline"
                  onClick={handleValidateCoupon}
                  disabled={validatingCoupon || !couponCode.trim()}
                >
                  {validatingCoupon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Validar'
                  )}
                </Button>
              </div>
              {couponError && (
                <p className="text-sm text-red-500 mt-2">{couponError}</p>
              )}
              {couponValid && (
                <p className="text-sm text-green-500 mt-2 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Cupom válido!
                </p>
              )}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleContinue}
            >
              Continuar para criar conta
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Ao continuar, você concorda com nossos termos de serviço
        </p>
      </div>
    </div>
  );
}