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

      await supabase
        .from('whatsapp_validation_codes')
        .update({ used: true })
        .eq('id', validCode.id);

      const result = await signUp(email, password, fullName);

      if (result.error) throw new Error('Erro ao criar conta');
      if (!result.data?.user) throw new Error('Erro ao criar conta');

      await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          phone_number: `+55${cleanPhone}`
        })
        .eq('user_id', result.data.user.id);

      if (planId) {
        const { data: planData } = await supabase
          .from('subscription_plans')
          .select('role, name')
          .eq('id', planId)
          .single();

        if (planData && planData.role === 'trial') {
          await supabase.functions.invoke('activate-trial', {
            body: { user_id: result.data.user.id }
          });
        }
      }

      toast({
        title: "Conta criada!",
        description: "Bem-vindo à plataforma",
      });

      navigate('/');
    } catch (error) {
      console.error('Error during signup:', error);
      toast({
        title: "Erro ao criar conta",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive"
      });
      setStep('verify-whatsapp');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword || !fullName || !phoneNumber) {
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

    await handleSendWhatsAppCode();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-6 w-6" />
          Criar Conta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="João Silva"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="phoneNumber">WhatsApp</Label>
              <div className="flex gap-2">
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(11) 98765-4321"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enviaremos um código de verificação
              </p>
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a senha novamente"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando código...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Continuar
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate('/')}
              >
                Fazer login
              </Button>
            </div>
          </form>
        )}

        {step === 'verify-whatsapp' && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <Phone className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="font-semibold">Verifique seu WhatsApp</h3>
              <p className="text-sm text-muted-foreground">
                Enviamos um código de 6 dígitos para<br />
                <strong>{phoneNumber}</strong>
              </p>
            </div>

            <div>
              <Label htmlFor="code">Código de Verificação</Label>
              <Input
                id="code"
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <Button 
              onClick={handleVerifyAndSignUp} 
              className="w-full"
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar e Criar Conta'
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleSendWhatsAppCode}
              className="w-full"
              disabled={isLoading}
            >
              Reenviar código
            </Button>
          </div>
        )}

        {step === 'creating-account' && (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
            <h3 className="font-semibold mb-2">Criando sua conta...</h3>
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto configuramos tudo para você
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
