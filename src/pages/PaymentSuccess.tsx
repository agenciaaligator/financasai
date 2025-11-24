import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/hooks/useAuth';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { refreshStatus } = useSubscriptionStatus(session);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAndUpdate = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshStatus();
      setChecking(false);
    };

    checkAndUpdate();
  }, [refreshStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">🎉 Pagamento Confirmado!</h1>
          <p className="text-muted-foreground">
            Sua assinatura foi ativada com sucesso. Agora você tem acesso a todos os recursos premium!
          </p>
        </div>

        {checking && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Atualizando sua conta...
          </div>
        )}

        <div className="space-y-3 pt-4">
          <Button 
            onClick={() => navigate('/')} 
            className="w-full group"
            size="lg"
            disabled={checking}
          >
            Ir para o Dashboard
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <Button 
            onClick={() => navigate('/?tab=plans')} 
            variant="outline"
            className="w-full"
            disabled={checking}
          >
            Ver Minha Assinatura
          </Button>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            ✉️ Você receberá um email de confirmação em breve com todos os detalhes da sua assinatura.
          </p>
        </div>
      </Card>
    </div>
  );
}