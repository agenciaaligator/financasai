import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Crown, MessageSquare, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<'choose-plan' | 'setup-whatsapp' | 'welcome'>('choose-plan');
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'true');
    onComplete();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleSelectPlan = async (planType: 'trial' | 'premium') => {
    if (!user) return;

    setLoading(true);
    try {
      if (planType === 'trial') {
        console.log('[TRIAL DEBUG] Ativando trial para:', user.email);
        
        const { data: sessionData } = await supabase.auth.getSession();
        
        const { data, error } = await supabase.functions.invoke('activate-trial', {
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`
          }
        });

        if (error) {
          console.error('[TRIAL ERROR]', error);
          
          // FALLBACK: Se erro é por subscrição existente, continuar
          if (error.message?.includes('Plano ativo') || error.message?.includes('subscription')) {
            toast({
              title: "Trial já ativado anteriormente",
              description: "Continue para configurar seu WhatsApp",
            });
            setStep('setup-whatsapp');
            return;
          }
          
          throw error;
        }

        toast({
          title: "Trial ativado!",
          description: "Você tem 3 dias para testar todos os recursos",
        });
      } else {
        toast({
          title: "Premium selecionado",
          description: "Configure seu WhatsApp e depois finalize a assinatura",
        });
      }

      setStep('setup-whatsapp');
    } catch (error) {
      console.error('[ONBOARDING ERROR]', error);
      toast({
        title: "Erro ao ativar plano",
        description: "Continue mesmo assim para configurar o WhatsApp",
        variant: "destructive"
      });
      // Permitir continuar mesmo com erro
      setStep('setup-whatsapp');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número necessário",
        description: "Por favor, digite seu número de WhatsApp",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setGeneratedCode(null);
    
    try {
      console.log('[WHATSAPP AUTH] Solicitando código para:', phoneNumber);
      
      // Normalizar número (adicionar + se não tiver)
      const normalizedPhone = phoneNumber.startsWith('+') 
        ? phoneNumber 
        : `+${phoneNumber}`;

      // Salvar número no perfil
      if (user) {
        await supabase
          .from('profiles')
          .update({ phone_number: normalizedPhone })
          .eq('user_id', user.id);
        
        console.log('[WHATSAPP AUTH] Número salvo no perfil:', normalizedPhone);
      }

      // Solicitar código via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          phone_number: normalizedPhone,
          action: 'auth'
        })
      });

      console.log('[WHATSAPP AUTH] Response status:', response.status);
      const result = await response.json();
      console.log('[WHATSAPP AUTH] Response data:', result);
      
      if (result.success && result.response) {
        // Extrair código da resposta (formato: "Seu código: *123456*")
        const codeMatch = result.response.match(/\*(\d{6})\*/);
        if (codeMatch) {
          setGeneratedCode(codeMatch[1]);
        }
        
        toast({
          title: "Código gerado!",
          description: "Insira o código de 6 dígitos abaixo",
        });
      } else {
        throw new Error(result.error || 'Falha ao gerar código');
      }
    } catch (error) {
      console.error('[WHATSAPP ERROR]', error);
      toast({
        title: "Erro ao solicitar código",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode || authCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "Digite o código de 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message: {
            body: `codigo ${authCode}`
          }
        })
      });

      const result = await response.json();
      
      if (result.success && result.response.includes('sucesso')) {
        toast({
          title: "🎉 WhatsApp conectado!",
          description: "Você receberá uma mensagem de boas-vindas",
        });
        
        // Marcar onboarding como completo
        localStorage.setItem('onboarding_complete', 'true');
        
        // Ir para o dashboard
        onComplete();
      } else {
        throw new Error('Código inválido');
      }
    } catch (error) {
      toast({
        title: "Código inválido",
        description: "Verifique o código e tente novamente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Etapa 1: Escolha de Plano
  if (step === 'choose-plan') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Bem-vindo ao FinançasAI! 🎉</h1>
            <p className="text-muted-foreground text-lg">Escolha seu plano para começar</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Trial Plan */}
            <Card className="border-2 hover:border-primary transition-all cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 text-accent" />
                  <CardTitle>Trial 3 Dias</CardTitle>
                </div>
                <p className="text-3xl font-bold">Grátis</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>50 transações</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>WhatsApp básico</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Sem foto/áudio</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Sem cartão de crédito</span>
                  </li>
                </ul>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => handleSelectPlan('trial')}
                  disabled={loading}
                >
                  {loading ? "Ativando..." : "Começar Trial"}
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Crown className="h-6 w-6 text-primary" />
                  <CardTitle>Premium</CardTitle>
                </div>
                <p className="text-3xl font-bold">R$ 39,90<span className="text-sm font-normal">/mês</span></p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Transações ilimitadas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>WhatsApp completo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Foto e áudio (OCR + IA)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Relatórios avançados</span>
                  </li>
                </ul>
                <Button 
                  className="w-full"
                  onClick={() => handleSelectPlan('premium')}
                  disabled={loading}
                >
                  {loading ? "Processando..." : "Escolher Premium"}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              Pular configuração e ir para o dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Etapa 2: Configuração WhatsApp
  if (step === 'setup-whatsapp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Configure o WhatsApp</CardTitle>
                <p className="text-sm text-muted-foreground">Passo obrigatório - 2 minutos</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium">✨ Após conectar, você poderá:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Adicionar transações por voz ou texto</li>
                <li>• Enviar fotos de notas fiscais</li>
                <li>• Consultar saldo e relatórios</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Formato internacional (sem +): 5511999999999
                </p>
              </div>

              {generatedCode && (
                <div className="bg-green-50 dark:bg-green-950 border-2 border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    📱 Código gerado com sucesso!
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 text-center mb-2">
                    {generatedCode}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 text-center">
                    Caso não tenha recebido no WhatsApp, use o código acima
                  </p>
                </div>
              )}

              {phoneNumber && (
                <div className="space-y-2">
                  <Label htmlFor="code">Código de verificação</Label>
                  <Input
                    id="code"
                    placeholder="123456"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite o código de 6 dígitos gerado
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleConnectWhatsApp}
                  disabled={loading || !phoneNumber}
                  className="flex-1"
                >
                  {loading ? "Enviando..." : "Enviar Código"}
                </Button>
                {authCode && (
                  <Button
                    onClick={handleVerifyCode}
                    disabled={loading || authCode.length !== 6}
                    variant="default"
                  >
                    Verificar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
          <div className="border-t p-6 flex justify-between items-center">
            <Button 
              variant="ghost" 
              onClick={handleSkip}
            >
              Pular configuração
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleLogout}
            >
              Sair
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
