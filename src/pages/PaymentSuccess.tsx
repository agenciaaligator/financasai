import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2, ArrowRight, AlertCircle, MessageCircle } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { status, refreshStatus } = useSubscriptionStatus(session);
  const [checking, setChecking] = useState(true);
  const [retried, setRetried] = useState(false);
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

  // Auto-retry once after 5s if still not subscribed (covers webhook delay)
  useEffect(() => {
    if (!checking && session && !status?.subscribed && !retried) {
      const timer = setTimeout(async () => {
        console.log('[PAYMENT-SUCCESS] Auto-retrying subscription check...');
        await refreshStatus();
        setRetried(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [checking, session, status, retried, refreshStatus]);

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

  // Logged in but NO active subscription -> webhook ainda processando, mensagem suave
  if (session && !status?.subscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-background">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
          <div className="flex justify-center">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
              <Loader2 className="h-16 w-16 text-amber-600 dark:text-amber-400 animate-spin" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Aguardando confirmação do pagamento</h1>
            <p className="text-muted-foreground">
              Isso costuma levar apenas alguns segundos. Se demorar mais que um minuto, clique em verificar novamente.
            </p>
          </div>
          <div className="space-y-2">
            <Button onClick={() => refreshStatus()} className="w-full group" size="lg">
              Verificar novamente
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button onClick={() => navigate('/choose-plan', { replace: true })} variant="ghost" className="w-full" size="sm">
              Voltar para planos
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Not logged in (rare: user paid in another tab/device) — guide to login.
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">{t('paymentSuccess.title', 'Pagamento confirmado!')}</h1>
          <p className="text-muted-foreground">
            {t('paymentSuccess.loginToContinue', 'Faça login com a mesma conta para conectar seu WhatsApp e começar a usar.')}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground/80 pt-2">
            <MessageCircle className="h-4 w-4" />
            <span>{t('paymentSuccess.nextStepWhatsApp', 'Próximo passo: conectar o WhatsApp')}</span>
          </div>
        </div>
        <Button onClick={() => navigate('/login')} className="w-full group" size="lg">
          {t('paymentSuccess.goToLogin')}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </Card>
    </div>
  );
}
