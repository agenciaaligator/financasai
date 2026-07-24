import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, CreditCard, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  getCurrencyFromLocale,
  getPriceId,
  getDisplayPrice,
  getYearlyMonthlyEquivalent,
  formatPrice,
} from "@/config/pricing";

export function PlansSection() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [loadingCycle, setLoadingCycle] = useState<'monthly' | 'yearly' | null>(null);

  const locale = i18n.language;
  const currency = getCurrencyFromLocale(locale);

  const featureKeys = [0, 1, 2, 3, 4, 5];

  const handleCheckout = async (cycle: 'monthly' | 'yearly') => {
    setLoadingCycle(cycle);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate(`/register?plan=${cycle}`);
        return;
      }
      toast({
        title: t('landing.plans.redirectingToast'),
        description: t('landing.plans.redirectingToastDesc'),
      });
      const priceId = getPriceId(cycle, locale);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, locale },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('URL de checkout não retornada');
      window.location.href = data.url;
    } catch (error) {
      console.error('[CHECKOUT] Error:', error);
      toast({
        title: t('landing.plans.errorTitle'),
        description: t('landing.plans.errorDesc'),
        variant: "destructive",
      });
      setLoadingCycle(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-stretch">
        {/* Mensal */}
        <div className="lift-sm rounded-3xl p-8 flex flex-col h-full bg-[hsl(var(--creme-2))] border border-[hsl(var(--border))] shadow-card">
          <h3 className="font-heading text-xl font-semibold text-primary mb-6">
            {t('landing.plans.monthlyTitle')}
          </h3>

          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl sm:text-5xl font-bold text-primary">
                {formatPrice(getDisplayPrice('monthly', locale), currency)}
              </span>
              <span className="text-muted-foreground">{t('landing.plans.perMonth')}</span>
            </div>
          </div>

          <ul className="space-y-3.5 mb-8 flex-1">
            {featureKeys.map((index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="icon-chip" style={{ width: 24, height: 24, borderRadius: 8 }}>
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-foreground/80 text-sm">{t(`landing.plans.features.${index}`)}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleCheckout('monthly')}
            disabled={loadingCycle !== null}
            className="w-full py-3.5 px-6 rounded-full bg-white text-primary font-semibold border-2 border-[hsl(var(--pinho))] hover:bg-[hsl(var(--sage))] lift-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingCycle === 'monthly' ? (
              <><Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />{t('landing.plans.redirecting')}</>
            ) : (
              <><CreditCard className="h-5 w-5" strokeWidth={2} />{t('landing.plans.startNow')}</>
            )}
          </button>

          <div className="mt-5 text-center space-y-1">
            <p className="text-sm text-muted-foreground">{t('landing.plans.cancelAnytime')}</p>
            <p className="text-sm text-muted-foreground">{t('landing.plans.noCommitment')}</p>
          </div>
        </div>

        {/* Anual */}
        <div className="relative lift-sm rounded-3xl p-8 md:scale-[1.03] flex flex-col h-full bg-[hsl(var(--creme-2))] border-2 border-[hsl(var(--mel))] shadow-lg">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap shadow-mel"
                 style={{ background: "hsl(var(--mel))", color: "hsl(var(--pinho))" }}>
              <Sparkles className="h-4 w-4" strokeWidth={2} />
              {t('landing.plans.bestValue')}
            </div>
          </div>

          <h3 className="font-heading text-xl font-semibold text-primary mb-6 mt-2">
            {t('landing.plans.annualTitle')}
          </h3>

          <div className="mb-2">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl sm:text-5xl font-bold text-primary">
                {formatPrice(getYearlyMonthlyEquivalent(locale), currency)}
              </span>
              <span className="text-muted-foreground">{t('landing.plans.perMonth')}</span>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {t('landing.plans.chargedAnnually')}: {formatPrice(getDisplayPrice('yearly', locale), currency)}{t('landing.plans.perYear')}
            </p>
          </div>

          <ul className="space-y-3.5 mb-8 flex-1">
            {featureKeys.map((index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="icon-chip mel" style={{ width: 24, height: 24, borderRadius: 8 }}>
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-foreground/85 text-sm">{t(`landing.plans.features.${index}`)}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleCheckout('yearly')}
            disabled={loadingCycle !== null}
            className="btn-mel w-full py-3.5 px-6 rounded-full font-semibold border-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingCycle === 'yearly' ? (
              <><Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />{t('landing.plans.redirecting')}</>
            ) : (
              <><CreditCard className="h-5 w-5" strokeWidth={2} />{t('landing.plans.startNow')}</>
            )}
          </button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t('landing.plans.couponHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
