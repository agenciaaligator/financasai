import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, CreditCard } from "lucide-react";
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

export function PlansSection() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  const locale = i18n.language;
  const currency = getCurrencyFromLocale(locale);
  const savings = calculateYearlySavings(locale);

  const displayPrice = cycle === 'monthly' 
    ? getDisplayPrice('monthly', locale)
    : getYearlyMonthlyEquivalent(locale);

  const featureKeys = [0, 1, 2, 3, 4, 5];

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
            {t('landing.plans.monthly')}
          </Button>
          <Button
            variant={cycle === 'yearly' ? 'default' : 'ghost'}
            onClick={() => setCycle('yearly')}
            className="rounded-md"
            size="sm"
          >
            {t('landing.plans.yearly')}
            <Badge variant="secondary" className="ml-2">
              -{savings}%
            </Badge>
          </Button>
        </div>
      </div>

      {/* Card do Plano Premium */}
      <Card className="border-2 border-primary shadow-lg relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
          {t('landing.plans.mostPopular')}
        </div>
        
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">{t('landing.plans.premiumTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('landing.plans.premiumDesc')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">
                {formatPrice(displayPrice, currency)}
              </span>
              <span className="text-muted-foreground">{t('landing.plans.perMonth')}</span>
            </div>
            {cycle === 'yearly' && (
              <p className="text-sm text-muted-foreground mt-1">
                {t('landing.plans.billedAnnually')} {formatPrice(getDisplayPrice('yearly', locale), currency)}
              </p>
            )}
          </div>

          <ul className="space-y-3">
            {featureKeys.map((index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{t(`landing.plans.features.${index}`)}</span>
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
            {t('landing.plans.couponHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
