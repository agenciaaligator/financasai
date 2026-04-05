import { Button } from "@/components/ui/button";
import { MessageCircle, DollarSign, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDisplayPrice, getCurrencyFromLocale, formatPrice } from "@/config/pricing";

interface WelcomeScreenProps {
  userName: string;
  selectedCycle: 'monthly' | 'yearly';
  onContinue: () => void;
  onSkip: () => void;
}

export const WelcomeScreen = ({
  userName,
  selectedCycle,
  onContinue,
  onSkip
}: WelcomeScreenProps) => {
  const { t, i18n } = useTranslation();
  const currency = getCurrencyFromLocale(i18n.language);
  const planPrice = formatPrice(getDisplayPrice(selectedCycle, i18n.language), currency);
  const cycleName = selectedCycle === 'monthly' ? t('welcome.monthly') : t('welcome.yearly');
  const planPeriod = selectedCycle === 'monthly' ? t('welcome.perMonth') : t('welcome.perYear');

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 border border-border">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('welcome.greeting', { name: userName })}</h1>
          <p className="text-muted-foreground mt-2">{t('welcome.accountReady')}</p>
        </div>

        {/* Plan Summary */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-2">📝 {t('welcome.orderSummary')}</h3>
            <p className="text-sm text-foreground">
              <strong>{t('welcome.plan')}:</strong> Premium {cycleName}<br/>
              <strong>{t('welcome.price')}:</strong> {planPrice}/{planPeriod}
            </p>
          </div>
        </div>

        {/* Next Steps */}
        <div className="mb-6">
          <h4 className="font-semibold text-foreground mb-3">📱 {t('welcome.getStarted')}:</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              <span>{t('welcome.tip1')}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span>{t('welcome.tip2')}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <span>{t('welcome.tip3')}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            onClick={onContinue}
            className="w-full"
            size="lg"
          >
            🚀 {t('welcome.goToDashboard')}
          </Button>
          <Button 
            variant="outline" 
            onClick={onSkip}
            className="w-full"
          >
            {t('welcome.viewSubscription')}
          </Button>
        </div>
      </div>
    </div>
  );
};
