import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2, ArrowRight, MessageCircle, Mail, KeyRound } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, user } = useAuth();
  const { refreshStatus } = useSubscriptionStatus(session);
  const [checking, setChecking] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [email, setEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { toast } = useToast();

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const checkAndUpdate = async () => {
      // Aguardar o webhook processar
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Se não tiver sessão, provavelmente é um novo usuário
      if (!session) {
        setIsNewUser(true);
        setChecking(false);
        return;
      }
      
      await refreshStatus();
      setChecking(false);
    };

    checkAndUpdate();
  }, [refreshStatus, session]);

  const handleRequestPasswordReset = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return;
    }

    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetSent(true);
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para definir sua senha.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSendingReset(false);
    }
  };

  // Se for novo usuário (sem sessão), mostrar tela para definir senha
  if (isNewUser || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Pagamento Confirmado!</h1>
            <p className="text-muted-foreground">
              Sua assinatura foi ativada com sucesso!
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Próximo passo: Defina sua senha</p>
                <p className="text-sm text-muted-foreground">
                  Enviamos um email com um link para você criar sua senha de acesso.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Verifique sua caixa de entrada</p>
                <p className="text-sm text-muted-foreground">
                  Procure pelo email "Bem-vindo ao Dona Wilma" e clique no botão para definir sua senha.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Conecte seu WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  Após fazer login, você poderá conectar seu WhatsApp na tela de boas-vindas.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Não recebeu o email? Insira seu email abaixo para solicitar novamente.
            </p>
            
            {resetSent ? (
              <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-lg text-center">
                <p className="text-green-700 dark:text-green-300 font-medium">
                  Email enviado! Verifique sua caixa de entrada.
                </p>
              </div>
            ) : (
              <>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                />
                
                <Button 
                  onClick={handleRequestPasswordReset}
                  className="w-full group"
                  size="lg"
                  disabled={sendingReset || !email}
                >
                  {sendingReset ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Enviar Link para Definir Senha
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </>
            )}
            
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="w-full"
            >
              Já tenho senha - Fazer Login
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Se não receber o email em alguns minutos, verifique sua caixa de spam ou clique em "Definir Minha Senha" acima.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Usuário já logado - redirecionar para boas-vindas para configurar WhatsApp
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Pagamento Confirmado!</h1>
          <p className="text-muted-foreground">
            Sua assinatura foi ativada com sucesso. Vamos configurar seu WhatsApp?
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
            onClick={() => navigate('/boas-vindas')} 
            className="w-full group"
            size="lg"
            disabled={checking}
          >
            Configurar WhatsApp
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          
          <Button 
            onClick={() => navigate('/')} 
            variant="outline"
            className="w-full"
            disabled={checking}
          >
            Pular e ir para o Dashboard
          </Button>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Você receberá um email de confirmação em breve com todos os detalhes da sua assinatura.
          </p>
        </div>
      </Card>
    </div>
  );
}
