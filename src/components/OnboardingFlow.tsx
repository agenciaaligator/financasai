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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";

  const handleSelectPlan = async (planType: 'trial' | 'premium') => {
    if (!user) return;

    setLoading(true);
    try {
      if (planType === 'trial') {
        // Ativar trial de 3 dias
        const { data: sessionData } = await supabase.auth.getSession();
        
        const { error } = await supabase.functions.invoke('activate-trial', {
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`
          }
        });

        if (error) throw error;

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
      toast({
        title: "Erro",
        description: "Não foi possível ativar o plano",
        variant: "destructive"
      });
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
    try {
      // Salvar número no perfil
      if (user) {
        await supabase
          .from('profiles')
          .update({ phone_number: phoneNumber.trim() })
          .eq('user_id', user.id);
      }

      // Solicitar código
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          action: 'auth'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Código enviado!",
          description: "Verifique o código gerado e insira abaixo",
        });
      } else {
        throw new Error(result.error || 'Falha ao enviar código');
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao conectar",
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
        </Card>
      </div>
    );
  }

  return null;
}
