import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, CreditCard, Star, Sparkles } from "lucide-react";
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
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Not logged in — redirect to register with plan info
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
      setLoadingCycle(null);
    }
  };

  return (
    <div className="relative py-20 px-4 overflow-hidden">
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(232,184,109,0.08)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(39,174,96,0.06)_0%,transparent_50%)]" />
      </div>
      
      <div className="relative max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
            {t('landing.plans.sectionTitle')}
          </h2>
          <p className="text-lg text-white/50">
            {t('landing.plans.sectionSubtitle')}
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-stretch">
          
          {/* Monthly Card */}
          <div className="glass-card-dark rounded-3xl p-8 flex flex-col h-full hover:-translate-y-2 transition-all duration-400">
            <h3 className="font-display text-xl font-semibold text-white mb-6">
              {t('landing.plans.monthlyTitle')}
            </h3>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl sm:text-5xl font-bold text-white">
                  {formatPrice(getDisplayPrice('monthly', locale), currency)}
                </span>
                <span className="text-white/50">{t('landing.plans.perMonth')}</span>
              </div>
            </div>

            <ul className="space-y-3.5 mb-8 flex-1">
              {featureKeys.map((index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="p-0.5 rounded-full bg-success/20 mt-0.5">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                  <span className="text-white/85 text-sm">{t(`landing.plans.features.${index}`)}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loadingCycle !== null}
              className="w-full py-3.5 px-6 rounded-2xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingCycle === 'monthly' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('landing.plans.redirecting')}
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  {t('landing.plans.startNow')}
                </>
              )}
            </button>

            <div className="mt-5 text-center space-y-1">
              <p className="text-sm text-white/40">{t('landing.plans.cancelAnytime')}</p>
              <p className="text-sm text-white/40">{t('landing.plans.noCommitment')}</p>
            </div>
          </div>

          {/* Annual Card (highlighted) */}
          <div className="relative glass-card-dark rounded-3xl p-8 md:scale-[1.03] flex flex-col h-full border-2 border-primary/40 shadow-[0_0_60px_rgba(43,91,132,0.3)] hover:-translate-y-2 transition-all duration-400">
            {/* Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1.5 bg-gradient-primary text-white px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap shadow-primary">
                <Sparkles className="h-4 w-4" />
                {t('landing.plans.bestValue')}
              </div>
            </div>

            <h3 className="font-display text-xl font-semibold text-white mb-6 mt-2">
              {t('landing.plans.annualTitle')}
            </h3>

            <div className="mb-2">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl sm:text-5xl font-bold text-white">
                  {formatPrice(getDisplayPrice('yearly', locale), currency)}
                </span>
                <span className="text-white/50">{t('landing.plans.perYear')}</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-white/50">
                {t('landing.plans.equivalentTo')} {formatPrice(getYearlyMonthlyEquivalent(locale), currency)}{t('landing.plans.perMonth')}
              </p>
              <p className="text-sm text-white/50">
                {t('landing.plans.chargedAnnually')}
              </p>
            </div>

            <ul className="space-y-3.5 mb-8 flex-1">
              {featureKeys.map((index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="p-0.5 rounded-full bg-success/20 mt-0.5">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                  <span className="text-white/85 text-sm">{t(`landing.plans.features.${index}`)}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout('yearly')}
              disabled={loadingCycle !== null}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-primary text-white font-semibold hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-primary"
            >
              {loadingCycle === 'yearly' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('landing.plans.redirecting')}
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  {t('landing.plans.startNow')}
                </>
              )}
            </button>

            <p className="mt-5 text-center text-sm text-white/40">
              {t('landing.plans.couponHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
