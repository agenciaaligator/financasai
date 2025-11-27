import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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
  
  // Capturar query params do fluxo de escolha de plano
  const searchParams = new URLSearchParams(window.location.search);
  const selectedCycle = searchParams.get('cycle') || 'monthly';
  const couponCode = searchParams.get('coupon') || '';

  // Função para verificar se usuário já existe
  const checkExistingUser = async (email: string, phone: string) => {
    try {
      // Limpar e padronizar o telefone (remover +55 se existir)
      const cleanPhone = phone.replace(/^\+55/, '').replace(/\D/g, '');
      console.log('[SIGNUP] Verificando usuário existente:', { email, phone: cleanPhone });
      
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

      // 2. Verificar telefone na tabela profiles (com e sem +55)
      const { data: profilesWithPhone, error: phoneError } = await supabase
        .from('profiles')
        .select('email, phone_number, user_id')
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.+55${cleanPhone}`);

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

      // 3. Verificar sessão ativa no WhatsApp (com e sem +55)
      const { data: activeSessions, error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number, user_id')
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.+55${cleanPhone}`)
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
        console.log('[SIGNUP] ❌ WhatsApp com sessão ativa:', cleanPhone, 'vinculado a', linkedEmail);
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

    const cleanPhone = formData.phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Digite um número válido com DDD (ex: 11999999999)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // CRÍTICO: Verificar duplicatas ANTES de enviar código
    const isAvailable = await checkExistingUser(formData.email, cleanPhone);
    if (!isAvailable) {
      setLoading(false);
      // PARAR completamente se houver duplicata
      return;
    }

    try {
      console.log('[SIGNUP] Enviando código WhatsApp para:', cleanPhone);
      
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: { 
          action: 'send-validation-code',
          phone_number: cleanPhone,
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
      // 1. VALIDAR CÓDIGO ANTES DE CRIAR CONTA
      const cleanPhone = formData.phoneNumber.replace(/\D/g, '');
      console.log('[SIGNUP] Validando código WhatsApp');
      
      const { data: codeValidation, error: validationError } = await supabase
        .from('whatsapp_validation_codes')
        .select('*')
        .eq('phone_number', cleanPhone)
        .eq('code', whatsappCode)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (validationError) {
        console.error('[SIGNUP] Erro ao validar código:', validationError);
        throw validationError;
      }

      if (!codeValidation) {
        console.log('[SIGNUP] ❌ Código inválido ou expirado');
        throw new Error('Código inválido ou expirado. Solicite um novo código.');
      }

      console.log('[SIGNUP] ✅ Código válido');

      // 2. Marcar código como usado
      const { error: updateError } = await supabase
        .from('whatsapp_validation_codes')
        .update({ used: true })
        .eq('id', codeValidation.id);

      if (updateError) {
        console.error('[SIGNUP] Erro ao marcar código como usado:', updateError);
      }

      // 3. Criar conta no Supabase Auth
      console.log('[SIGNUP] Criando conta no Supabase Auth');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone_number: cleanPhone,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Usuário não criado');

      console.log('[SIGNUP] ✅ Conta criada com sucesso!', signUpData);

      // 4. Criar sessão WhatsApp automaticamente
      console.log('[SIGNUP] Criando sessão WhatsApp');
      const { error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .insert({
          user_id: signUpData.user.id,
          phone_number: cleanPhone,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
        });

      if (sessionError) {
        console.error('[SIGNUP] Erro ao criar sessão WhatsApp:', sessionError);
      } else {
        console.log('[SIGNUP] ✅ WhatsApp conectado automaticamente');
      }

      toast({
        title: "✅ Conta criada com sucesso!",
        description: "Verificando cupom e redirecionando...",
      });

      // 5. Verificar se tem cupom para ativar trial OU redirecionar para checkout
      if (couponCode) {
        console.log('[SIGNUP] Ativando cupom:', couponCode);
        
        const { data: couponData, error: couponError } = await supabase.functions.invoke('activate-trial-coupon', {
          body: { couponCode },
        });

        if (couponError || !couponData?.success) {
          console.error('[SIGNUP] Erro ao ativar cupom:', couponError);
          toast({
            title: "Aviso",
            description: "Não foi possível ativar o cupom. Redirecionando para checkout...",
            variant: "destructive",
          });
          // Redirecionar para checkout mesmo assim
          setTimeout(() => {
            navigate(`/?tab=subscription&cycle=${selectedCycle}`);
          }, 2000);
        } else {
          // Cupom ativado com sucesso - trial iniciado
          toast({
            title: "🎉 Trial ativado!",
            description: "30 dias grátis ativados! Redirecionando...",
          });
          setTimeout(() => {
            navigate('/?tab=dashboard');
          }, 2000);
        }
      } else {
        // Sem cupom - redirecionar para checkout
        setTimeout(() => {
          navigate(`/?tab=subscription&cycle=${selectedCycle}`);
        }, 2000);
      }
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

            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="11999999999"
                maxLength={11}
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Digite apenas números com DDD (ex: 11999999999)
              </p>
            </div>

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