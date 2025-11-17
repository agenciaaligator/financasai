import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2 } from "lucide-react";

interface EmailConfirmationProps {
  email: string;
}

export function EmailConfirmation({ email }: EmailConfirmationProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="max-w-md w-full bg-gradient-card shadow-primary border-0">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="p-4 bg-gradient-primary rounded-full">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            ✅ Cadastro realizado!
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-muted-foreground">
              Enviamos um link de confirmação para:
            </p>
            <p className="text-lg font-semibold text-primary break-all">
              {email}
            </p>
          </div>

          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">Verifique sua caixa de entrada</p>
                <p className="text-muted-foreground">
                  Não esqueça de verificar a pasta de <strong>spam/lixo eletrônico</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Depois de confirmar seu email, você poderá fazer login e começar a usar o Aligator.
            </p>
            
            <Button 
              onClick={() => navigate('/')} 
              className="w-full bg-gradient-primary hover:shadow-primary"
            >
              Ir para o Login
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Não recebeu o email?{" "}
              <button 
                className="text-primary hover:underline font-medium"
                onClick={() => {
                  // Implementar reenvio de email se necessário
                  alert('Função de reenvio será implementada');
                }}
              >
                Reenviar confirmação
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EmailConfirmation;
