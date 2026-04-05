import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useCheckout } from "@/hooks/useCheckout";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getCurrencyFromLocale, formatPrice as formatCurrencyPrice, getPriceId, getDisplayPrice, getYearlyMonthlyEquivalent } from "@/config/pricing";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { t, i18n } = useTranslation();
  const currency = getCurrencyFromLocale(i18n.language);
  const { isPremium } = useSubscription();
  const { createCheckoutSession, loading } = useCheckout();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'yearly'>('monthly');

  const monthlyPrice = getDisplayPrice('monthly', i18n.language);
  const yearlyPrice = getDisplayPrice('yearly', i18n.language);
  const monthlyEquivalent = getYearlyMonthlyEquivalent(i18n.language);

  const featureKeys = [
    'upgrade.features.unlimitedTransactions',
    'upgrade.features.unlimitedCategories',
    'upgrade.features.whatsapp',
    'upgrade.features.aiReports',
    'upgrade.features.googleCalendar',
    'upgrade.features.prioritySupport',
  ];

  const handleSubscribe = () => {
    const priceId = getPriceId(selectedCycle, i18n.language);
    if (!priceId) {
      toast({
        title: "❌ " + t('common.error'),
        description: t('upgrade.priceError'),
        variant: "destructive"
      });
      return;
    }
    createCheckoutSession(priceId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('upgrade.title')}</DialogTitle>
          <DialogDescription>
            {reason || t('upgrade.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h3 className="font-semibold mb-2">{t('upgrade.whyPremium')}</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ {t('upgrade.reasons.financial')}</li>
              <li>✓ {t('upgrade.reasons.whatsapp')}</li>
              <li>✓ {t('upgrade.reasons.aiReports')}</li>
              <li>✓ {t('upgrade.reasons.calendar')}</li>
            </ul>
          </div>

          <div className="flex justify-center">
            <div className="inline-flex rounded-lg border border-border p-1 bg-background">
              <button
                onClick={() => setSelectedCycle('monthly')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedCycle === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('upgrade.monthly')}
              </button>
              <button
                onClick={() => setSelectedCycle('yearly')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedCycle === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('upgrade.yearly')}
                <span className="ml-2 text-xs">(-40%)</span>
              </button>
            </div>
          </div>

          <Card className="border-primary shadow-lg relative">
            <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
              ⭐ Premium
            </Badge>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-semibold">Premium</h3>
              </div>

              <div>
                <div className="text-3xl font-bold">
                  {formatCurrencyPrice(selectedCycle === 'monthly' ? monthlyPrice : monthlyEquivalent, currency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('upgrade.perMonth')}
                </div>
                {selectedCycle === 'yearly' && (
                  <>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('upgrade.chargedAnnually')} {formatCurrencyPrice(yearlyPrice, currency)}/{t('upgrade.perYearShort')}
                    </div>
                    <Badge variant="secondary" className="mt-2">
                      💰 {t('upgrade.save40')}
                    </Badge>
                  </>
                )}
              </div>

              <ul className="space-y-2">
                {featureKeys.map((key, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{t(key)}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={handleSubscribe}
                disabled={isPremium || loading}
                className="w-full"
              >
                {isPremium ? t('upgrade.currentPlan') : t('upgrade.subscribeNow')}
              </Button>
            </div>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            {t('upgrade.couponNote')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
