import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, MessageCircle, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { LanguageFlagSelector } from "@/components/LanguageFlagSelector";

export default function Welcome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  
  const [step, setStep] = useState<'phone' | 'code' | 'connected'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.full_name) {
        setUserName(profile.full_name);
      }
      
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number, expires_at')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (session) {
        setPhoneNumber(session.phone_number);
        setStep('connected');
      } else if (profile?.phone_number) {
        setPhoneNumber(profile.phone_number);
      }
    };

    fetchProfile();
  }, [user, loading]);

  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: t('welcome.invalidNumber'),
        description: t('welcome.invalidNumberDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone_number', phoneNumber)
        .neq('user_id', user?.id || '')
        .maybeSingle();

      if (existingPhone) {
        toast({
          title: t('welcome.numberAlreadyRegistered'),
          description: t('welcome.numberAlreadyRegisteredDesc', { email: existingPhone.email }),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data: activeSession } = await supabase
        .from('whatsapp_sessions')
        .select('user_id')
        .eq('phone_number', phoneNumber)
        .neq('user_id', user?.id || '')
        .maybeSingle();

      if (activeSession) {
        toast({
          title: t('welcome.whatsappInUse'),
          description: t('welcome.whatsappInUseDesc'),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: {
          action: 'send-validation-code',
          phone_number: phoneNumber,
          userId: user?.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao enviar código');

      toast({
        title: t('welcome.codeSent'),
        description: t('welcome.codeSentDesc', { phone: phoneNumber }),
      });
      
      setStep('code');
    } catch (error) {
      console.error('[Welcome] Erro ao enviar código:', error);
      toast({
        title: t('welcome.sendError'),
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
        title: t('welcome.invalidCode'),
        description: t('welcome.invalidCodeDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: {
          action: 'validate-code',
          phone_number: phoneNumber,
          code: verificationCode,
          userId: user?.id,
        },
      });

      if (error) throw error;
      if (!data?.valid && !data?.success) throw new Error(data?.message || data?.error || 'Código inválido ou expirado');

      // Atualizar telefone no perfil (não-bloqueante)
      supabase
        .from('profiles')
        .update({ phone_number: phoneNumber })
        .eq('user_id', user?.id)
        .then(({ error: profileError }) => {
          if (profileError) console.warn('[Welcome] Profile update error:', profileError);
        });

      toast({
        title: t('welcome.connectedSuccess'),
        description: t('welcome.connectedSuccessDesc'),
      });
      sessionStorage.removeItem('onboarding_completed');
      sessionStorage.removeItem('redirected_to_welcome');
      setStep('connected');
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: t('welcome.invalidCode'),
        description: error instanceof Error ? error.message : t('welcome.invalidCodeDesc'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    sessionStorage.setItem('onboarding_completed', 'true');
    sessionStorage.removeItem('redirected_to_welcome');
    navigate('/', { replace: true });
  };

  const isWhatsAppConnected = step === 'connected';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#F8F9FA]/50 flex items-center justify-center px-4 py-8">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </div>
          <LanguageFlagSelector />
        </nav>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-[800px] mt-20 animate-fadeInUp">
        {/* Progress Bar */}
        <div className="flex items-center justify-center gap-0 mb-12">
          {/* Step 1: Account Created */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 lg:w-15 lg:h-15 rounded-full bg-success flex items-center justify-center text-white">
              <Check className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <span className="text-xs mt-2 text-success font-medium text-center max-w-[80px]">
              {t('welcome.stepAccountCreated')}
            </span>
          </div>
          
          <div className="w-[120px] h-[3px] bg-success mt-[-16px]" />
          
          {/* Step 2: Email Confirmed */}
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 lg:w-15 lg:h-15 rounded-full bg-success flex items-center justify-center text-white">
              <Check className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <span className="text-xs mt-2 text-success font-medium text-center max-w-[80px]">
              {t('welcome.stepEmailConfirmed')}
            </span>
          </div>
          
          <div className={`w-[120px] h-[3px] mt-[-16px] ${isWhatsAppConnected ? 'bg-success' : 'bg-muted-foreground/30'}`} />
          
          {/* Step 3: Connect WhatsApp */}
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 lg:w-15 lg:h-15 rounded-full flex items-center justify-center ${
              isWhatsAppConnected 
                ? 'bg-success text-white' 
                : 'bg-primary text-white scale-110 shadow-[0_0_20px_rgba(43,91,132,0.3)]'
            }`}>
              {isWhatsAppConnected ? (
                <Check className="h-5 w-5 lg:h-6 lg:w-6" />
              ) : (
                <MessageCircle className="h-5 w-5 lg:h-6 lg:w-6 text-2xl" />
              )}
            </div>
            <span className={`text-xs mt-2 font-medium text-center max-w-[80px] ${
              isWhatsAppConnected ? 'text-success' : 'text-primary'
            }`}>
              {t('welcome.stepConnectWhatsApp')}
            </span>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-[24px] bg-card shadow-[0_8px_25px_rgba(43,91,132,0.08)] overflow-hidden">
          {/* Header Gradiente */}
          <div className="relative bg-gradient-to-br from-[#2B5B84] to-[#1e4a6b] p-8 lg:p-12 pb-8 text-center">
            {/* Elemento decorativo blur */}
            <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
            
            {/* Emoji comemorativo */}
            <div className="text-[4rem] animate-bounceCustom mb-4">🎉</div>
            
            {/* Título */}
            <h1 className="font-heading text-[2.5rem] text-white mb-2">
              Parabéns, {userName || 'Usuário'}!
            </h1>
            <p className="text-white/90 text-lg">
              Sua conta Dona Wilma está quase pronta
            </p>
          </div>

          {/* Conteúdo */}
          <div className="p-8 lg:p-12">
            {/* Seção WhatsApp */}
            <div className="text-center mb-10">
              {/* Ícone WhatsApp */}
              <div className="w-20 h-20 bg-gradient-to-br from-[#25D366] to-[#1da851] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulseGlow shadow-[0_0_30px_rgba(37,211,102,0.3)]">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-semibold text-[#2B5B84] mb-3">
                {t('welcome.connectWhatsApp')}
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                É aqui que a <strong>mágica acontece</strong>! Conecte seu WhatsApp e comece a gerenciar tudo por mensagem.
              </p>

              {/* Formulário */}
              {step === 'phone' && (
                <div className="max-w-[400px] mx-auto space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-base font-medium">
                      {t('welcome.phoneLabel')}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="11999999999"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      className="rounded-[16px] px-5 py-4 text-base focus:border-[#2B5B84] focus:shadow-[0_0_20px_rgba(43,91,132,0.1)]"
                      disabled={isLoading}
                    />
                    <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
                      📱 {t('welcome.phoneHint')}
                    </p>
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-[#25D366] to-[#1da851] text-white rounded-full px-8 py-4 shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(37,211,102,0.4)] transition-all duration-300"
                    size="lg"
                    onClick={handleSendCode}
                    disabled={isLoading || !phoneNumber}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t('welcome.sending')}
                      </>
                    ) : (
                      <>
                        🚀 {t('welcome.sendCode')}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {step === 'code' && (
                <div className="max-w-[400px] mx-auto space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-base font-medium">
                      {t('welcome.codeLabel')}
                    </Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={t('welcome.codePlaceholder')}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={isLoading}
                      className="rounded-[16px] text-center text-2xl tracking-widest px-5 py-4 focus:border-[#2B5B84] focus:shadow-[0_0_20px_rgba(43,91,132,0.1)]"
                      maxLength={6}
                    />
                    <p className="text-sm text-muted-foreground">
                      {t('welcome.codeHint', { phone: phoneNumber })}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('phone')}
                      disabled={isLoading}
                      className="flex-1 rounded-[16px]"
                    >
                      {t('welcome.back')}
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-[#25D366] to-[#1da851] text-white rounded-[16px] shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(37,211,102,0.4)] transition-all duration-300"
                      onClick={handleVerifyCode}
                      disabled={isLoading || verificationCode.length < 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {t('welcome.verifying')}
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          {t('welcome.verify')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {step === 'connected' && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{t('welcome.connected')}</h3>
                  <p className="text-muted-foreground mb-2">
                    {t('welcome.number')} {phoneNumber}
                  </p>
                  <Badge variant="secondary" className="mb-4">
                    {t('welcome.readyToUse')}
                  </Badge>
                </div>
              )}
            </div>

            {/* Grid de Dicas */}
            <div className="bg-[#2B5B84]/[0.03] rounded-[20px] p-8 mb-8">
              <h3 className="text-xl font-semibold text-center mb-6 flex items-center justify-center gap-2">
                💡 Como usar no WhatsApp
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF] hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(43,91,132,0.1)] transition-all duration-300">
                  <div className="text-[2rem] mb-3">💰</div>
                  <h4 className="font-semibold mb-2">Despesas</h4>
                  <p className="text-sm text-muted-foreground">"Gastei 50 no mercado"</p>
                </div>
                
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF] hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(43,91,132,0.1)] transition-all duration-300">
                  <div className="text-[2rem] mb-3">📈</div>
                  <h4 className="font-semibold mb-2">Receitas</h4>
                  <p className="text-sm text-muted-foreground">"Recebi 1000 salário"</p>
                </div>
                
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF] hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(43,91,132,0.1)] transition-all duration-300">
                  <div className="text-[2rem] mb-3">📊</div>
                  <h4 className="font-semibold mb-2">Saldo</h4>
                  <p className="text-sm text-muted-foreground">"Saldo do mês"</p>
                </div>
                
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF] hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(43,91,132,0.1)] transition-all duration-300">
                  <div className="text-[2rem] mb-3">📸</div>
                  <h4 className="font-semibold mb-2">Fotos</h4>
                  <p className="text-sm text-muted-foreground">Envie foto do cupom</p>
                </div>
              </div>
            </div>

            {/* Botão Final */}
            <div className="text-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#25D366] to-[#1da851] text-white rounded-full px-12 py-4 text-lg font-bold shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(37,211,102,0.4)] transition-all duration-300"
                onClick={handleGoToDashboard}
                disabled={step !== 'connected'}
              >
                🚀 {t('welcome.startUsing')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}