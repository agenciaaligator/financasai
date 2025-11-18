import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, UserPlus, Phone, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Step = 'form' | 'verify-whatsapp' | 'creating-account';

export function SignUpForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plano') || null;
  
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sentCode, setSentCode] = useState(false);
  
  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleSendWhatsAppCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "Telefone obrigatório",
        description: "Digite seu número de WhatsApp",
        variant: "destructive"
      });
      return;
    }

    // Validar formato do telefone
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Digite um número válido com DDD",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Enviar código via WhatsApp
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: { 
          action: 'send-validation-code',
          phone_number: `+55${cleanPhone}`,
          code 
        }
      });

      if (error) throw error;

      setSentCode(true);
      setStep('verify-whatsapp');
      
      toast({
        title: "Código enviado!",
        description: `Enviamos um código de 6 dígitos para ${phoneNumber}`,
      });
    } catch (error) {
      console.error('Error sending code:', error);
      toast({
        title: "Erro ao enviar código",
        description: "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndSignUp = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "Digite o código de 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setStep('creating-account');
    
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // 1. Validar código WhatsApp
      const { data: codes } = await supabase
        .from('whatsapp_validation_codes')
        .select('*')
        .eq('code', verificationCode)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString());
      
      const validCode = codes && codes.length > 0 ? codes[0] : null;

      if (!validCode) {
        throw new Error('Código inválido ou expirado');
      }

      // Marcar código como usado
      await supabase
        .from('whatsapp_validation_codes')
        .update({ used: true })
        .eq('id', validCode.id);

      // 2. Criar conta
      const result = await signUp(email, password, fullName);
      
      if (result && result.error) {
        throw new Error(result.error.message);
      }

      // 3. Obter user ID recém-criado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Erro ao obter dados do usuário');
      }

      // 4. Atualizar profile com telefone
      await supabase
        .from('profiles')
        .update({ phone_number: `+55${cleanPhone}` })
        .eq('user_id', user.id);

      // 5. Limpar transações de teste (se houver)
      await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      // 6. Ativar plano escolhido
      if (planId) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', planId)
          .single();

        if (plan) {
          if (plan.role === 'trial') {
            // Ativar trial
            await supabase.functions.invoke('activate-trial');
          } else if (plan.role === 'premium') {
            // Redirecionar para Stripe checkout
            const priceId = plan.stripe_price_id_monthly;
            if (priceId) {
              const { data: checkout } = await supabase.functions.invoke('create-checkout', {
                body: { priceId }
              });
              
              if (checkout?.url) {
                window.open(checkout.url, '_blank');
              }
            }
          }
        }
      }

      toast({
        title: "Conta criada com sucesso! ✅",
        description: "Verifique seu email para confirmar a conta",
      });
      
      // Redirecionar para dashboard
      navigate('/');
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive"
      });
      setStep('verify-whatsapp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!email || !password || !fullName || !phoneNumber) {
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
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    // Enviar código WhatsApp
    await handleSendWhatsAppCode();
  };

  return (
    <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-primary rounded-full">
            {step === 'creating-account' ? (
              <CheckCircle2 className="h-8 w-8 text-white" />
            ) : step === 'verify-whatsapp' ? (
              <Phone className="h-8 w-8 text-white" />
            ) : (
              <UserPlus className="h-8 w-8 text-white" />
            )}
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          {step === 'creating-account' ? 'Criando sua conta...' :
           step === 'verify-whatsapp' ? 'Verificar WhatsApp' :
           'Criar Conta'}
        </CardTitle>
        <p className="text-muted-foreground">
          {step === 'creating-account' ? 'Aguarde enquanto configuramos tudo para você' :
           step === 'verify-whatsapp' ? `Código enviado para ${phoneNumber}` :
           'Preencha seus dados para começar'}
        </p>
      </CardHeader>
      
      <CardContent>
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">WhatsApp</Label>
              <Input
                id="phoneNumber"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Digite com DDD. Enviaremos um código de verificação.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando código...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Enviar código WhatsApp
                </div>
              )}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/')}
                className="text-primary hover:text-primary-dark"
              >
                Já tem uma conta? Entre aqui
              </Button>
            </div>
          </form>
        )}

        {step === 'verify-whatsapp' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Código de Verificação</Label>
              <Input
                id="verificationCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Digite o código de 6 dígitos enviado para seu WhatsApp
              </p>
            </div>

            <Button 
              onClick={handleVerifyAndSignUp}
              className="w-full bg-gradient-primary hover:shadow-primary"
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Verificar e Criar Conta
                </div>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep('form')}
              disabled={isLoading}
            >
              Voltar
            </Button>

            <Button
              type="button"
              variant="link"
              className="w-full text-sm"
              onClick={handleSendWhatsAppCode}
              disabled={isLoading}
            >
              Não recebeu? Reenviar código
            </Button>
          </div>
        )}

        {step === 'creating-account' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-center text-muted-foreground">
              Criando sua conta e configurando seu plano...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
