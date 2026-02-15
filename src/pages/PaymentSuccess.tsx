import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2, ArrowRight, LogIn } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { refreshStatus } = useSubscriptionStatus(session);
  const [checking, setChecking] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const checkAndUpdate = async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (session) {
        await refreshStatus();
      }
      setChecking(false);
    };
    checkAndUpdate();
  }, [refreshStatus, session]);

  // Logged-in user: redirect to welcome
  if (session && !checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{t('paymentSuccess.title')}</h1>
            <p className="text-muted-foreground">{t('paymentSuccess.subtitleLoggedIn')}</p>
          </div>
          <Button onClick={() => navigate('/boas-vindas')} className="w-full group" size="lg">
            {t('paymentSuccess.configureWhatsApp')}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            {t('paymentSuccess.skipToDashboard')}
          </Button>
        </Card>
      </div>
    );
  }

  // New user (no session): clean confirmation screen
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{t('paymentSuccess.title')}</h1>
          <p className="text-muted-foreground">{t('paymentSuccess.subtitle')}</p>
        </div>

        {checking ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('paymentSuccess.processing')}
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <Button onClick={() => navigate('/')} className="w-full group" size="lg">
              <LogIn className="mr-2 h-4 w-4" />
              {t('paymentSuccess.goToLogin')}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                {t('paymentSuccess.checkSpam')}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
