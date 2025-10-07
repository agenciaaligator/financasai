import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { refetch } = useSubscriptionStatus();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAndUpdate = async () => {
      // Wait a moment for Stripe to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetch();
      setChecking(false);
    };

    checkAndUpdate();
  }, [refetch]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircle className="h-20 w-20 text-success" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Pagamento Confirmado!</h1>
          <p className="text-muted-foreground">
            Sua assinatura foi ativada com sucesso.
          </p>
        </div>

        {checking && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Atualizando sua conta...
          </div>
        )}

        <div className="space-y-3 pt-4">
          <Button 
            onClick={() => navigate('/')} 
            className="w-full"
            size="lg"
          >
            Ir para o Dashboard
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Você já pode aproveitar todos os recursos premium!
        </p>
      </Card>
    </div>
  );
}
