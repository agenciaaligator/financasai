import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, MessageCircle, DollarSign, BarChart3, Mail } from "lucide-react";

interface WelcomeScreenProps {
  userName: string;
  selectedCycle: 'monthly' | 'yearly';
  couponCode?: string;
  onContinue: (action: 'trial' | 'checkout') => void;
  onSkip: () => void;
}

export const WelcomeScreen = ({
  userName,
  selectedCycle,
  couponCode,
  onContinue,
  onSkip
}: WelcomeScreenProps) => {
  const hasValidCoupon = couponCode?.toUpperCase() === 'FULLACCESS' || couponCode?.toUpperCase()?.startsWith('TESTE');
  const planPrice = selectedCycle === 'monthly' ? 'R$ 29,90' : 'R$ 299,00';
  const planPeriod = selectedCycle === 'monthly' ? 'mês' : 'ano';
  const cycleName = selectedCycle === 'monthly' ? 'Mensal' : 'Anual';

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 border border-border">
        {/* Cabeçalho */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo, {userName}!</h1>
          <p className="text-muted-foreground mt-2">Sua conta Dona Wilma está quase pronta</p>
        </div>

        {/* Status do Plano */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          {hasValidCoupon ? (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Trial ativado!</span>
              </div>
              <p className="text-sm text-foreground">
                <strong>Plano:</strong> Premium {cycleName}<br/>
                <strong>Após o trial:</strong> {planPrice}/{planPeriod}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <h3 className="font-semibold text-foreground mb-2">📝 Resumo do pedido</h3>
              <p className="text-sm text-foreground">
                <strong>Plano:</strong> Premium {cycleName}<br/>
                <strong>Valor:</strong> {planPrice}/{planPeriod}
              </p>
            </div>
          )}
        </div>

        {/* Próximos Passos */}
        <div className="mb-6">
          <h4 className="font-semibold text-foreground mb-3">📱 Comece agora:</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-500" />
              <span>Use comandos no WhatsApp: "Reunião amanhã às 14h"</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span>Registre gastos: "Gastei 50 no mercado"</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <span>Acompanhe relatórios automáticos</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="space-y-3">
          {hasValidCoupon ? (
            <>
              <Button 
                onClick={() => onContinue('trial')}
                className="w-full"
                size="lg"
              >
                🚀 Explorar Sistema Gratuitamente
              </Button>
              <Button 
                variant="outline" 
                onClick={onSkip}
                className="w-full"
              >
                Pular e ir para o Dashboard
              </Button>
            </>
          ) : (
            <>
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  <strong>Próximo passo:</strong> Verifique seu email para confirmar a conta. 
                  O checkout será iniciado automaticamente após a confirmação.
                </AlertDescription>
              </Alert>
              <Button 
                onClick={onSkip}
                className="w-full"
                size="lg"
              >
                📧 Entendi, vou verificar meu email
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
