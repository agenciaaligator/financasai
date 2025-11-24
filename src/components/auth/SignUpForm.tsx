import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function SignUpForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'form' | 'verify-whatsapp'>('form');
  const [loading, setLoading] = useState(false);
  const [sentCode, setSentCode] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [whatsappCode, setWhatsappCode] = useState("");
  
  const selectedPlanId = searchParams.get('plano');

  const checkExistingUser = async (email: string, phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // 1. Verificar email na tabela profiles
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      throw new Error('Este e-mail já está cadastrado. Faça login ou recupere sua senha.');
    }

    // 2. Verificar telefone na tabela profiles
    const { data: existingPhone } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('phone_number', cleanPhone)
      .maybeSingle();

    if (existingPhone) {
      throw new Error(`Este WhatsApp já está cadastrado no email ${existingPhone.email}. Use outro número.`);
    }

    // 3. Verificar se WhatsApp está em sessão ativa
    const { data: activeSession } = await supabase
      .from('whatsapp_sessions')
      .select('user_id, phone_number')
      .or(`phone_number.eq.+55${cleanPhone},phone_number.eq.${cleanPhone}`)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (activeSession) {
      // Buscar email do dono da sessão
      const { data: sessionOwner } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', activeSession.user_id)
        .single();

      throw new Error(
        `Este WhatsApp já está vinculado à conta ${sessionOwner?.email || 'existente'}. ` +
        `Desconecte o WhatsApp antes de usar em outra conta.`
      );
    }
  };

  const handleSendWhatsAppCode = async () => {
    if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "As senhas devem ser iguais",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      await checkExistingUser(email, phoneNumber);
      
      console.log('[SIGNUP] 📱 Iniciando envio de código WhatsApp');
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      console.log('[SIGNUP] 📞 Telefone limpo:', cleanPhone);
      console.log('[SIGNUP] 📧 Email:', email);

      console.log('[SIGNUP] 🚀 Chamando edge function whatsapp-agent');
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: { 
          action: 'send-validation-code',
          phone_number: `+55${cleanPhone}`,
          debug: true // ✅ MODO DEBUG ATIVADO
        }
      });
      
      console.log('[SIGNUP] 📥 Resposta da edge function:', { data, error });
      
      if (error) {
        console.error('[SIGNUP] ❌ Erro na edge function:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('[SIGNUP] ❌ Edge function retornou sucesso=false:', data);
        throw new Error(data?.message || 'Falha ao enviar código');
      }

      console.log('[SIGNUP] ✅ Código enviado com sucesso!');

      // 🔐 FALLBACK VISUAL: Se estiver em modo debug, mostra o código
      if (data?.debug_mode && data?.code) {
        console.log('[SIGNUP] 🐛 DEBUG MODE: Mostrando código na tela');
        toast({
          title: "🔐 Código de Verificação (DEBUG)",
          description: `Seu código: ${data.code}\n\nEste código também foi enviado para seu WhatsApp.`,
          duration: 30000, // 30 segundos
        });
      }
      
      setSentCode(true);
      setStep('verify-whatsapp');
      toast({ 
        title: "Código enviado!",
        description: "Verifique seu WhatsApp"
      });
    } catch (error: any) {
      console.error('[SIGNUP] ❌ Erro geral:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar código",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSignUp = async () => {
    if (!whatsappCode) {
      toast({
        title: "Código obrigatório",
        description: "Digite o código recebido no WhatsApp",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // 1. VALIDAR CÓDIGO ANTES DE CRIAR CONTA
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const { data: codeValidation } = await supabase
        .from('whatsapp_validation_codes')
        .select('*')
        .eq('phone_number', `+55${cleanPhone}`)
        .eq('code', whatsappCode)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!codeValidation) {
        throw new Error('Código inválido ou expirado. Solicite um novo código.');
      }

      // 2. Marcar código como usado
      await supabase
        .from('whatsapp_validation_codes')
        .update({ used: true })
        .eq('id', codeValidation.id);

      // 3. AGORA SIM criar a conta
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: cleanPhone,
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) throw signUpError;

      if (user) {
        toast({
          title: "✅ Conta criada com sucesso!",
          description: "Redirecionando para escolha de plano...",
        });

        // 4. Redirecionar para escolha de plano
        setTimeout(() => {
          if (selectedPlanId) {
            navigate(`/?tab=plans&selected=${selectedPlanId}`);
          } else {
            navigate('/?tab=plans');
          }
        }, 2000);
      }
    } catch (error: any) {
      toast({
        title: "❌ Erro ao criar conta",
        description: error.message,
        variant: "destructive"
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
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
