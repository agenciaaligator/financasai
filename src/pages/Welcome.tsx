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
import { useTranslation } from "react-i18next";
import { LanguageFlagSelector } from "@/components/LanguageFlagSelector";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import '@/components/ui/phone-input.css';

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
      if (!data?.success) throw new Error(data?.error || 'Código inválido ou expirado');

      await supabase
        .from('whatsapp_sessions')
        .upsert({
          user_id: user?.id,
          phone_number: phoneNumber,
          expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          last_activity: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      await supabase
        .from('profiles')
        .update({ phone_number: phoneNumber })
        .eq('user_id', user?.id);

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
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </div>
          <LanguageFlagSelector />
        </nav>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Progress Bar */}
        <div className="flex items-center justify-center gap-0 mb-12">
          {/* Step 1: Account Created */}
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
              <Check className="h-5 w-5" />
            </div>
            <span className="text-xs mt-2 text-green-600 font-medium text-center max-w-[80px]">
              {t('welcome.stepAccountCreated')}
            </span>
          </div>
          
          <div className="w-12 h-0.5 bg-green-500 mt-[-16px]" />
          
          {/* Step 2: Email Confirmed */}
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
              <Check className="h-5 w-5" />
            </div>
            <span className="text-xs mt-2 text-green-600 font-medium text-center max-w-[80px]">
              {t('welcome.stepEmailConfirmed')}
            </span>
          </div>
          
          <div className={`w-12 h-0.5 mt-[-16px] ${isWhatsAppConnected ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
          
          {/* Step 3: Connect WhatsApp */}
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isWhatsAppConnected 
                ? 'bg-green-500 text-white' 
                : 'bg-blue-500 text-white animate-pulse'
            }`}>
              {isWhatsAppConnected ? <Check className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            </div>
            <span className={`text-xs mt-2 font-medium text-center max-w-[80px] ${
              isWhatsAppConnected ? 'text-green-600' : 'text-blue-600'
            }`}>
              {t('welcome.stepConnectWhatsApp')}
            </span>
          </div>
        </div>

        {/* Welcome Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">
            {t('welcome.congratulations')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isWhatsAppConnected 
              ? t('welcome.allSetDesc', { defaultValue: 'Tudo pronto! Você já pode usar o Dona Wilma.' })
              : t('welcome.connectToStart')
            }
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
                <CardTitle>{t('welcome.connectWhatsApp')}</CardTitle>
                <CardDescription>
                  {t('welcome.connectDesc')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === 'phone' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('welcome.phoneLabel')}</Label>
                  <PhoneInput
                    international
                    defaultCountry="BR"
                    value={phoneNumber}
                    onChange={(value) => setPhoneNumber(value || '')}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('welcome.phoneHint')}
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
                      {t('welcome.sending')}
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-5 w-5" />
                      {t('welcome.sendCode')}
                    </>
                  )}
                </Button>
              </>
            )}

            {step === 'code' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="code">{t('welcome.codeLabel')}</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t('welcome.codePlaceholder')}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={isLoading}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('welcome.codeHint', { phone: phoneNumber })}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('phone')}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {t('welcome.back')}
                  </Button>
                  <Button
                    className="flex-1"
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
              </>
            )}

            {step === 'connected' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
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
          </CardContent>
        </Card>

        {/* Quick Start Tips */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">{t('welcome.tipsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: t('welcome.tip1') }} />
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: t('welcome.tip2') }} />
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: t('welcome.tip3') }} />
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: t('welcome.tip4') }} />
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full text-base font-bold"
            onClick={handleGoToDashboard}
            disabled={step !== 'connected'}
          >
            🚀 {t('welcome.startUsing')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
