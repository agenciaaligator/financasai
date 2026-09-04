import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Check, CreditCard, Star, QrCode, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getCurrencyFromLocale,
  getPriceId,
  getDisplayPrice,
  getYearlyMonthlyEquivalent,
  formatPrice,
} from "@/config/pricing";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ChoosePlan() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const locale = i18n.language;
  const currency = getCurrencyFromLocale(locale);

  const featureKeys = [0, 1, 2, 3, 4, 5];
  const showPix = getCurrencyFromLocale(locale) === 'BRL';

  const handleSelectPlan = async (cycle: 'monthly' | 'yearly', pix = false) => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      const params = new URLSearchParams({ plan: cycle });
      if (pix) params.set('pix', '1');
      navigate(`/register?${params.toString()}`);
      return;
    }

    setLoading(pix ? `pix-${cycle}` : cycle);
    try {
      if (pix) {
        const { data, error } = await supabase.functions.invoke('create-pix-checkout', {
          body: { cycle },
        });
        if (error) throw error;
        if (!data?.url) throw new Error('URL não retornada');
        window.location.href = data.url;
      } else {
        const priceId = getPriceId(cycle, locale);
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { priceId, locale },
        });
        if (error) throw error;
        if (!data?.url) throw new Error('URL não retornada');
        window.location.href = data.url;
      }
    } catch (error) {
      toast({
        title: t('landing.plans.errorTitle'),
        description: t('landing.plans.errorDesc'),
        variant: "destructive",
      });
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(161,45%,10%)] via-[hsl(161,33%,17%)] to-[hsl(157,32%,25%)]">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <BrandLogo className="h-8" invert />
          </div>
          <Button variant="ghost" onClick={() => navigate('/')} className="border border-white/20 text-white hover:bg-white/10 hover:text-white">
            {t('common.back')}
          </Button>
        </nav>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white mb-3">
            {t('landing.plans.sectionTitle')}
          </h1>
          <p className="text-lg text-white/60">
            {t('landing.plans.sectionSubtitle')}
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-start">
          
          {/* Monthly Card */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 flex flex-col h-full">
            <h3 className="text-xl font-semibold text-white mb-6">
              {t('landing.plans.monthlyTitle')}
            </h3>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white">
                  {formatPrice(getDisplayPrice('monthly', locale), currency)}
                </span>
                <span className="text-white/60">{t('landing.plans.perMonth')}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {featureKeys.map((index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/90">{t(`landing.plans.features.${index}`)}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan('monthly')}
              disabled={loading !== null}
              className="w-full py-3 px-6 rounded-xl bg-white/20 text-white font-semibold border border-white/30 hover:bg-white/30 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading === 'monthly' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
              {loading === 'monthly' ? t('landing.plans.redirecting') : t('landing.plans.startNow')}
            </button>

            {showPix && (
              <button
                onClick={() => handleSelectPlan('monthly', true)}
                disabled={loading !== null}
                className="w-full mt-3 py-2.5 px-6 rounded-xl bg-transparent text-white/80 font-medium border border-white/20 hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {loading === 'pix-monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {loading === 'pix-monthly' ? t('landing.plans.redirecting') : t('landing.plans.payWithPix', 'Pagar com Pix')}
              </button>
            )}

            <div className="mt-4 text-center space-y-1">
              <p className="text-sm text-white/50">{t('landing.plans.cancelAnytime')}</p>
              <p className="text-sm text-white/50">{t('landing.plans.noCommitment')}</p>
            </div>
          </div>

          {/* Annual Card (highlighted) */}
          <div className="relative bg-white/10 backdrop-blur-lg border-2 border-primary/60 rounded-2xl p-8 md:scale-105 flex flex-col h-full shadow-2xl shadow-primary/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap">
                <Star className="h-4 w-4" />
                {t('landing.plans.bestValue')}
              </div>
            </div>

            <h3 className="text-xl font-semibold text-white mb-6 mt-2">
              {t('landing.plans.annualTitle')}
            </h3>

            <div className="mb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white">
                  {formatPrice(getDisplayPrice('yearly', locale), currency)}
                </span>
                <span className="text-white/60">{t('landing.plans.perYear')}</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-white/60">
                {t('landing.plans.equivalentTo')} {formatPrice(getYearlyMonthlyEquivalent(locale), currency)}{t('landing.plans.perMonth')}
              </p>
              <p className="text-sm text-white/60">
                {t('landing.plans.chargedAnnually')}
              </p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {featureKeys.map((index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-white/90">{t(`landing.plans.features.${index}`)}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSelectPlan('yearly')}
              disabled={loading !== null}
              className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading === 'yearly' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
              {loading === 'yearly' ? t('landing.plans.redirecting') : t('landing.plans.startNow')}
            </button>

            {showPix && (
              <button
                onClick={() => handleSelectPlan('yearly', true)}
                disabled={loading !== null}
                className="w-full mt-3 py-2.5 px-6 rounded-xl bg-transparent text-white/80 font-medium border border-white/20 hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {loading === 'pix-yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                {loading === 'pix-yearly' ? t('landing.plans.redirecting') : t('landing.plans.payWithPix', 'Pagar com Pix')}
              </button>
            )}

            <p className="mt-4 text-center text-sm text-white/50">
              {t('landing.plans.couponHint')}
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-white/40 mt-8">
          {t('landing.plans.termsAgreement')}
        </p>
      </div>
    </div>
  );
}
