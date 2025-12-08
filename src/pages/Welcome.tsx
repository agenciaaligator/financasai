import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, MessageCircle, Loader2, ArrowRight, Phone, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import '@/components/ui/phone-input.css';

export default function Welcome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [step, setStep] = useState<'phone' | 'code' | 'connected'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    // Fetch user name from profile
    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.full_name) {
        setUserName(profile.full_name);
      }
      
      // Check if WhatsApp is already connected
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number, expires_at')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (session) {
        setPhoneNumber(session.phone_number);
        setStep('connected');
      } else if (profile?.phone_number) {
        setPhoneNumber(profile.phone_number);
      }
    };

    fetchProfile();
  }, [user, navigate]);

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Número inválido",
        description: "Digite um número de telefone válido com DDD",
        variant: "destructive",
      });
      return;
    }

    console.log('[Welcome] Iniciando envio de código para:', phoneNumber);
    setIsLoading(true);
    
    try {
      console.log('[Welcome] Chamando whatsapp-agent com action: send-validation-code');
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: {
          action: 'send-validation-code',
          phoneNumber,
          userId: user?.id,
        },
      });

      console.log('[Welcome] Resposta do whatsapp-agent:', { data, error });

      if (error) {
        console.error('[Welcome] Erro da edge function:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('[Welcome] Edge function retornou falha:', data);
        throw new Error(data?.error || 'Falha ao enviar código');
      }

      console.log('[Welcome] Código enviado com sucesso, mudando para step: code');
      toast({
        title: "📱 Código enviado!",
        description: `Verifique seu WhatsApp (${phoneNumber}) para o código de verificação`,
      });
      
      // GARANTIR que setStep é chamado
      setStep('code');
      console.log('[Welcome] Step atualizado para: code');
      
    } catch (error) {
      console.error('[Welcome] Erro ao enviar código:', error);
      toast({
        title: "Erro ao enviar código",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 4) {
      toast({
        title: "Código inválido",
        description: "Digite o código de 6 dígitos recebido no WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: {
          action: 'validate-code',
          phoneNumber,
          code: verificationCode,
          userId: user?.id,
        },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Código inválido ou expirado');
      }

      // Create WhatsApp session
      await supabase
        .from('whatsapp_sessions')
        .upsert({
          user_id: user?.id,
          phone_number: phoneNumber,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          last_activity: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      // Update profile phone number
      await supabase
        .from('profiles')
        .update({ phone_number: phoneNumber })
        .eq('user_id', user?.id);

      toast({
        title: "✅ WhatsApp conectado!",
        description: "Você já pode usar comandos pelo WhatsApp",
      });
      setStep('connected');
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: "Código inválido",
        description: error instanceof Error ? error.message : "Verifique o código e tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </div>
        </nav>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-2xl">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Bem-vindo{userName ? `, ${userName.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-muted-foreground text-lg">
            Sua conta Premium está ativa. Vamos configurar seu WhatsApp?
          </p>
        </div>

        {/* WhatsApp Connection Card */}
        <Card className="border-2 shadow-xl mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle>Conectar WhatsApp</CardTitle>
                <CardDescription>
                  Receba lembretes e gerencie suas finanças pelo WhatsApp
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === 'phone' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Número do WhatsApp</Label>
                  <PhoneInput
                    international
                    defaultCountry="BR"
                    value={phoneNumber}
                    onChange={(value) => setPhoneNumber(value || '')}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enviaremos um código de verificação para este número
                  </p>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSendCode}
                  disabled={isLoading || !phoneNumber}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-5 w-5" />
                      Enviar código
                    </>
                  )}
                </Button>
              </>
            )}

            {step === 'code' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="code">Código de verificação</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Digite o código de 6 dígitos"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={isLoading}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    O código foi enviado para {phoneNumber}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('phone')}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleVerifyCode}
                    disabled={isLoading || verificationCode.length < 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Verificar
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {step === 'connected' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">WhatsApp conectado!</h3>
                <p className="text-muted-foreground mb-2">
                  Número: {phoneNumber}
                </p>
                <Badge variant="secondary" className="mb-4">
                  ✓ Pronto para usar
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Start Tips */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Dicas para começar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Envie <strong>"Gastei 50 no mercado"</strong> para registrar despesas</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Envie <strong>"Reunião amanhã às 14h"</strong> para agendar compromissos</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Envie uma <strong>foto de recibo</strong> para registrar automaticamente</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Pergunte <strong>"Quanto gastei este mês?"</strong> para relatórios</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={handleGoToDashboard}
          >
            Ir para o sistema
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          {step !== 'connected' && (
            <Button
              variant="ghost"
              onClick={handleGoToDashboard}
              className="text-muted-foreground"
            >
              Pular por agora
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
