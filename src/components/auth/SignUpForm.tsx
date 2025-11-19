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

      const userId = result.data?.user?.id;
      if (userId) {
        await supabase
          .from('profiles')
          .update({ phone_number: `+55${cleanPhone}` })
          .eq('user_id', userId);
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Você será redirecionado em instantes...",
      });

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      console.error('Error verifying code:', error);
      setStep('verify-whatsapp');
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !fullName || !phoneNumber) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
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

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "As senhas digitadas são diferentes",
        variant: "destructive"
      });
      return;
    }

    await handleSendWhatsAppCode();
  };

  if (step === 'creating-account') {
    return (
      <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
        <CardContent className="pt-12 pb-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">Criando sua conta...</h3>
              <p className="text-sm text-muted-foreground">
                Aguarde enquanto configuramos tudo para você
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify-whatsapp') {
    return (
      <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-primary rounded-full">
              <Phone className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Verifique seu WhatsApp
          </CardTitle>
          <p className="text-muted-foreground">
            Digite o código de 6 dígitos que enviamos para {phoneNumber}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código de verificação</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <Button 
              onClick={handleVerifyAndSignUp}
              className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200"
              disabled={isLoading || verificationCode.length !== 6}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verificando...
                </div>
              ) : (
                <div className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verificar e criar conta
                </div>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleSendWhatsAppCode}
              className="w-full"
              disabled={isLoading}
            >
              Reenviar código
            </Button>

            <Button
              type="button"
              variant="link"
              onClick={() => setStep('form')}
              className="w-full"
            >
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-primary rounded-full">
            <UserPlus className="h-8 w-8 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          Criar conta
        </CardTitle>
        <p className="text-muted-foreground">
          {planId ? 'Complete seu cadastro para continuar' : 'Preencha os dados para criar sua conta'}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
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
            <Label htmlFor="phone">WhatsApp</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
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
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Digite a senha novamente"
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
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando código...
              </div>
            ) : (
              <div className="flex items-center">
                <UserPlus className="h-4 w-4 mr-2" />
                Continuar
              </div>
            )}
          </Button>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-center text-muted-foreground mb-3">
              Já tem uma conta?
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Fazer login
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
