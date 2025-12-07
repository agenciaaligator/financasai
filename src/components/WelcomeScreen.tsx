import { Button } from "@/components/ui/button";
import { MessageCircle, DollarSign, BarChart3 } from "lucide-react";

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
          <p className="text-muted-foreground mt-2">Sua conta Dona Wilma está pronta</p>
        </div>

        {/* Status do Plano */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <div className="text-center">
            <h3 className="font-semibold text-foreground mb-2">📝 Resumo do pedido</h3>
            <p className="text-sm text-foreground">
              <strong>Plano:</strong> Premium {cycleName}<br/>
              <strong>Valor:</strong> {planPrice}/{planPeriod}
            </p>
          </div>
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
          <Button 
            onClick={onContinue}
            className="w-full"
            size="lg"
          >
            🚀 Ir para o Dashboard
          </Button>
          <Button 
            variant="outline" 
            onClick={onSkip}
            className="w-full"
          >
            Ver minha assinatura
          </Button>
        </div>
      </div>
    </div>
  );
};
