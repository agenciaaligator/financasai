import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2, ArrowRight, AlertCircle, Mail } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { status, refreshStatus } = useSubscriptionStatus(session);
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

  // Auto-redirect if logged in + subscription active
  useEffect(() => {
    if (!checking && session && status?.subscribed) {
      const timer = setTimeout(() => {
        navigate('/boas-vindas', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [checking, session, status, navigate]);

  // Still checking
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <Loader2 className="h-16 w-16 text-green-600 dark:text-green-400 animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{t('paymentSuccess.title')}</h1>
            <p className="text-muted-foreground">{t('paymentSuccess.processing')}</p>
          </div>
        </Card>
      </div>
    );
  }

  // Logged in + subscription active -> auto-redirecting to /boas-vindas
  if (session && status?.subscribed) {
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
            <p className="text-muted-foreground">{t('paymentSuccess.redirecting')}</p>
          </div>
          <Button onClick={() => navigate('/boas-vindas', { replace: true })} className="w-full group" size="lg">
            {t('paymentSuccess.goToWelcome')}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </Card>
      </div>
    );
  }

  // Not logged in (main case) - tell user to check email
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">{t('paymentSuccess.title')}</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Mail className="h-5 w-5" />
            <p>{t('paymentSuccess.emailSent')}</p>
          </div>
          <p className="text-sm text-muted-foreground/70">{t('paymentSuccess.checkSpam')}</p>
        </div>
        <Button onClick={() => navigate('/login')} className="w-full group" size="lg">
          {t('paymentSuccess.goToLogin')}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </Card>
    </div>
  );
}
