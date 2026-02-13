import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { 
  getCurrencyFromLocale,
  getPriceId,
  getDisplayPrice,
  getYearlyMonthlyEquivalent,
  formatPrice,
  calculateYearlySavings,
} from "@/config/pricing";

export default function ChoosePlan() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  const locale = i18n.language;
  const currency = getCurrencyFromLocale(locale);
  const savings = calculateYearlySavings(locale);

  const handleCheckout = async () => {
    setIsLoading(true);
    
    try {
      toast({
        title: t('landing.plans.redirectingToast'),
        description: t('landing.plans.redirectingToastDesc'),
      });

      const priceId = getPriceId(cycle, locale);
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, locale },
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
        title: t('landing.plans.errorTitle'),
        description: t('landing.plans.errorDesc'),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const displayPrice = cycle === 'monthly' 
    ? getDisplayPrice('monthly', locale)
    : getYearlyMonthlyEquivalent(locale);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            {t('common.back')}
          </Button>
        </nav>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            {t('landing.plans.choosePlanTitle')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('landing.plans.choosePlanDesc')}
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
              {t('landing.plans.monthly')}
            </Button>
            <Button
              variant={cycle === 'yearly' ? 'default' : 'ghost'}
              onClick={() => setCycle('yearly')}
              className="rounded-md"
            >
              {t('landing.plans.yearly')}
              <Badge variant="secondary" className="ml-2">
                -{savings}%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Card do Plano */}
        <Card className="border-2 border-primary shadow-xl mb-8">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-3xl">{t('landing.plans.premiumTitle')}</CardTitle>
              <Badge className="text-sm">{t('landing.plans.mostPopular')}</Badge>
            </div>
            <CardDescription>
              {t('landing.plans.premiumDesc')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">
                {formatPrice(displayPrice, currency)}
              </span>
              <span className="text-muted-foreground">{t('landing.plans.perMonth')}</span>
            </div>

            {cycle === 'yearly' && (
              <p className="text-sm text-muted-foreground">
                {t('landing.plans.billedAnnually')} {formatPrice(getDisplayPrice('yearly', locale), currency)}
              </p>
            )}

            <ul className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{t(`landing.plans.features.${index}`)}</span>
                </li>
              ))}
            </ul>

            <p className="text-sm text-muted-foreground border-t pt-4">
              {t('landing.plans.couponHint')}
            </p>

            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('landing.plans.redirecting')}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" />
                  {t('landing.plans.goToPayment')}
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t('landing.plans.securePayment')}
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t('landing.plans.termsAgreement')}
        </p>
      </div>
    </div>
  );
}
