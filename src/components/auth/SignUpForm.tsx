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
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    const cleanPhone = phone.replace(/\D/g, '');
    const { data: existingPhone } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone_number', cleanPhone)
      .single();

    if (existingEmail) {
      throw new Error('Este e-mail já está cadastrado');
    }
    if (existingPhone) {
      throw new Error('Este telefone já está cadastrado');
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
      
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const { data, error } = await supabase.functions.invoke('whatsapp-agent', {
        body: { 
          action: 'send-validation-code',
          phone_number: `+55${cleanPhone}`,
        }
      });
      
      if (error) throw error;
      
      setSentCode(true);
      setStep('verify-whatsapp');
      toast({ 
        title: "Código enviado!",
        description: "Verifique seu WhatsApp"
      });
    } catch (error: any) {
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
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber.replace(/\D/g, ''),
            whatsapp_code: whatsappCode
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) throw signUpError;

      if (user) {
        toast({
          title: "Conta criada com sucesso!",
          description: "Você será redirecionado em instantes..."
        });

        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
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
