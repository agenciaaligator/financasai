import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export default function PaymentCancelled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="flex justify-center">
          <XCircle className="h-20 w-20 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Pagamento Cancelado</h1>
          <p className="text-muted-foreground">
            O processo de pagamento foi cancelado. Nenhuma cobrança foi realizada.
          </p>
        </div>

        <div className="space-y-3 pt-4">
          <Button 
            onClick={() => navigate('/')} 
            className="w-full"
            size="lg"
          >
            Voltar ao Dashboard
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Você pode tentar novamente a qualquer momento.
        </p>
      </Card>
    </div>
  );
}
