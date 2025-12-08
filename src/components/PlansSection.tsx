import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";
import { 
  DISPLAY_PRICES, 
  formatPrice, 
  calculateYearlySavings 
} from "@/config/pricing";

export function PlansSection() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  const savings = calculateYearlySavings();

  const displayPrice = cycle === 'monthly' 
    ? DISPLAY_PRICES.monthly 
    : DISPLAY_PRICES.yearlyMonthlyEquivalent;

  const features = [
    'Transações ilimitadas',
    'Categorias ilimitadas',
    'WhatsApp integrado',
    'Relatórios com IA',
    'Google Calendar',
    'Multi-usuário',
    'Suporte prioritário',
  ];

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
            onClick={() => navigate('/choose-plan')}
          >
            Começar agora
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
