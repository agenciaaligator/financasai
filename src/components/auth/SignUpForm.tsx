import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneInput } from "@/components/ui/phone-input";
import { Loader2 } from "lucide-react";
import { isValidPhoneNumber } from "react-phone-number-input";

export function SignUpForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
  });
  const [step, setStep] = useState<'form' | 'verify-whatsapp'>('form');
  const [whatsappCode, setWhatsappCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  
  // Capturar query params do fluxo de escolha de plano
  const searchParams = new URLSearchParams(window.location.search);
  const selectedCycle = searchParams.get('cycle') || 'monthly';
  const couponCode = searchParams.get('coupon') || '';

  // Validação em tempo real do telefone
  useEffect(() => {
    if (formData.phoneNumber && formData.phoneNumber.length > 3) {
      if (!isValidPhoneNumber(formData.phoneNumber)) {
        setPhoneError('Parece que faltam alguns dígitos. Um celular no Brasil tem 11 números (2 do DDD + 9 do celular)');
      } else {
        setPhoneError('');
      }
    } else {
      setPhoneError('');
    }
  }, [formData.phoneNumber]);

  // Função para verificar se usuário já existe
  const checkExistingUser = async (email: string, phone: string) => {
    try {
      // Phone já vem no formato E.164 (+5511999999999)
      console.log('[SIGNUP] Verificando usuário existente:', { email, phone });
      
      // 1. Verificar email na tabela profiles
      const { data: profileByEmail, error: emailError } = await supabase
        .from('profiles')
        .select('email, user_id')
        .eq('email', email)
        .maybeSingle();

      if (emailError) {
        console.error('[SIGNUP] Erro ao verificar email:', emailError);
        throw emailError;
      }

      if (profileByEmail) {
        console.log('[SIGNUP] ❌ Email já cadastrado:', profileByEmail.email);
        toast({
          title: "❌ Email já cadastrado",
          description: `O email ${profileByEmail.email} já está vinculado a uma conta.`,
          variant: "destructive",
        });
        return false;
      }

      // 2. Verificar telefone na tabela profiles (formato E.164)
      const { data: profilesWithPhone, error: phoneError } = await supabase
        .from('profiles')
        .select('email, phone_number, user_id')
        .eq('phone_number', phone);

      if (phoneError) {
        console.error('[SIGNUP] Erro ao verificar telefone:', phoneError);
        throw phoneError;
      }

      if (profilesWithPhone && profilesWithPhone.length > 0) {
        const existingProfile = profilesWithPhone[0];
        console.log('[SIGNUP] ❌ Telefone já cadastrado:', existingProfile.phone_number, 'vinculado a', existingProfile.email);
        toast({
          title: "❌ WhatsApp já cadastrado",
          description: `Este número está vinculado à conta ${existingProfile.email}. Use outro número ou faça login.`,
          variant: "destructive",
        });
        return false;
      }

      // 3. Verificar sessão ativa no WhatsApp (formato E.164)
      const { data: activeSessions, error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number, user_id')
        .eq('phone_number', phone)
        .gt('expires_at', new Date().toISOString());

      if (sessionError) {
        console.error('[SIGNUP] Erro ao verificar sessão WhatsApp:', sessionError);
        // Não bloquear se houver erro ao verificar sessão
      }

      if (activeSessions && activeSessions.length > 0) {
        const activeSession = activeSessions[0];
        
        // Buscar email do dono da sessão
        const { data: sessionOwner } = await supabase
          .from('profiles')
          .select('email')
          .eq('user_id', activeSession.user_id)
          .maybeSingle();
        
        const linkedEmail = sessionOwner?.email || 'uma conta';
        console.log('[SIGNUP] ❌ WhatsApp com sessão ativa:', phone, 'vinculado a', linkedEmail);
        toast({
          title: "❌ WhatsApp em uso",
          description: `Este WhatsApp está ativo em ${linkedEmail}. Desconecte-o antes de usar em outra conta.`,
          variant: "destructive",
          duration: 8000,
        });
        return false;
      }

      console.log('[SIGNUP] ✅ Email e WhatsApp disponíveis');
      return true;
    } catch (error) {
      console.error('[SIGNUP] Erro ao verificar usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar dados. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleSendWhatsAppCode = async () => {
    // Validações
    if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.password) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos antes de continuar",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    // Validar telefone com biblioteca internacional
    if (!isValidPhoneNumber(formData.phoneNumber)) {
      toast({
        title: "Telefone inválido",
        description: "Verifique se o país está correto e se digitou o número completo com DDD",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // CRÍTICO: Verificar duplicatas ANTES de enviar código (phone já vem no formato E.164)
    const isAvailable = await checkExistingUser(formData.email, formData.phoneNumber);
    if (!isAvailable) {
      setLoading(false);
      // PARAR completamente se houver duplicata
      return;
    }

    try {
      console.log('[SIGNUP] Enviando código WhatsApp para:', formData.phoneNumber);
      
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: { 
          action: 'send-validation-code',
          phone_number: formData.phoneNumber,
        },
      });

      if (error) throw error;

      console.log('[SIGNUP] Resposta do envio:', data);

      if (data?.code_sent) {
        toast({
          title: "✅ Código enviado!",
          description: "Verifique seu WhatsApp e insira o código abaixo",
        });
        setStep('verify-whatsapp');
      } else {
        throw new Error(data?.message || 'Erro ao enviar código');
      }
    } catch (error: any) {
      console.error('[SIGNUP] Erro ao enviar código:', error);
      toast({
        title: "Erro ao enviar código",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar código WhatsApp e criar conta
  const handleVerifyAndSignUp = async () => {
    if (!whatsappCode) {
      toast({
        title: "Código obrigatório",
        description: "Digite o código recebido no WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. VALIDAR CÓDIGO VIA EDGE FUNCTION (phone já no formato E.164)
      console.log('[SIGNUP] Validando código WhatsApp para:', formData.phoneNumber);
      
      const { data: validationResult, error: validationError } = await supabase.functions.invoke('whatsapp-agent', {
        body: { 
          action: 'validate-code',
          phone_number: formData.phoneNumber,
          code: whatsappCode,
        },
      });

      if (validationError) {
        console.error('[SIGNUP] Erro ao validar código:', validationError);
        throw validationError;
      }

      if (!validationResult?.valid) {
        console.log('[SIGNUP] ❌ Código inválido ou expirado');
        throw new Error('Código inválido ou expirado. Solicite um novo código.');
      }

      console.log('[SIGNUP] ✅ Código válido');

      // 2. Marcar código como usado
      const { error: updateError } = await supabase
        .from('whatsapp_validation_codes')
        .update({ used: true })
        .eq('id', validationResult.code_id);

      if (updateError) {
        console.error('[SIGNUP] Erro ao marcar código como usado:', updateError);
      }

      // 3. Backup params em sessionStorage antes do signup
      sessionStorage.setItem('pending_checkout', 'true');
      sessionStorage.setItem('checkout_cycle', selectedCycle);
      if (couponCode) {
        sessionStorage.setItem('checkout_coupon', couponCode);
      }
      
      // 4. Criar conta no Supabase Auth (phone já no formato E.164)
      console.log('[SIGNUP] Criando conta no Supabase Auth com phone:', formData.phoneNumber);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone_number: formData.phoneNumber,
          },
          emailRedirectTo: `${window.location.origin}/?pending_checkout=true&cycle=${selectedCycle}${couponCode ? `&coupon=${couponCode}` : ''}`,
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Usuário não criado');

      console.log('[SIGNUP] ✅ Conta criada com sucesso! WhatsApp será conectado automaticamente após validação do email.', signUpData);

      toast({
        title: "✅ Conta criada!",
        description: "Verifique seu email para confirmar e acessar o sistema.",
      });

      // Aguardar confirmação de email (não redirecionar aqui)
    } catch (error: any) {
      console.error('[SIGNUP] Erro ao criar conta:', error);
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          {step === 'form' 
            ? 'Preencha seus dados para começar'
            : 'Digite o código enviado para seu WhatsApp'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'form' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <PhoneInput
              id="phone"
              label="WhatsApp"
              value={formData.phoneNumber}
              onChange={(value) => setFormData({ ...formData, phoneNumber: value })}
              defaultCountry="BR"
              error={phoneError}
              helperText="Selecione seu país e digite o número completo com DDD"
              placeholder="Digite seu número"
              required
            />

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleSendWhatsAppCode}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código WhatsApp"}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="code">Código de verificação</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={whatsappCode}
                onChange={(e) => setWhatsappCode(e.target.value)}
                maxLength={6}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleVerifyAndSignUp}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
            </Button>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setStep('form')}
              disabled={loading}
            >
              Voltar
            </Button>
          </>
        )}

        <div className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{' '}
          <Button 
            variant="link" 
            className="p-0 h-auto"
            onClick={() => navigate('/')}
          >
            Entrar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}