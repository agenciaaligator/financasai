import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";

interface LoginFormProps {
  onToggleMode: () => void;
  isSignUp: boolean;
}

export function LoginForm({ onToggleMode, isSignUp }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, signUp, checkEmailExists } = useAuth();
  const { toast } = useToast();

  // Verificação em tempo real do email (apenas durante cadastro)
  const handleEmailChange = async (value: string) => {
    setEmail(value);
    setEmailExists(false);
    
    if (isSignUp && value && value.includes('@') && value.includes('.')) {
      setCheckingEmail(true);
      try {
        const exists = await checkEmailExists(value);
        setEmailExists(exists);
      } catch (err) {
        console.error('Erro ao verificar email:', err);
      } finally {
        setCheckingEmail(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive"
      });
      return;
    }

    if (isSignUp && !fullName) {
      return;
    }

    setIsLoading(true);
    
    try {
      if (isSignUp) {
        // Validação adicional antes do cadastro
        if (password.length < 6) {
          toast({
            title: "Senha muito curta",
            description: "A senha deve ter pelo menos 6 caracteres.",
            variant: "destructive"
          });
          return;
        }

        const result = await signUp(email, password, fullName);
        
        // Se houve sucesso e não há erro, limpar formulário
        if (result && !result.error) {
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setFullName('');
        }
      } else {
        const result = await signIn(email, password);
        
        // Se login bem-sucedido, limpar campos de senha
        if (result && !result.error) {
          setPassword('');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-primary rounded-full">
            <Eye className="h-8 w-8 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          {isSignUp ? 'Criar Conta' : 'Entrar'}
        </CardTitle>
        <p className="text-muted-foreground">
          {isSignUp 
            ? 'Crie sua conta para começar a gerenciar suas finanças'
            : 'Entre em sua conta para acessar o dashboard'
          }
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
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
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={emailExists && isSignUp ? "border-destructive" : ""}
                required
              />
              {checkingEmail && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
            {emailExists && isSignUp && (
              <div className="text-sm text-destructive flex items-center gap-2">
                ⚠️ Este email já possui conta.{" "}
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-destructive underline"
                  onClick={onToggleMode}
                >
                  Fazer login
                </Button>
              </div>
            )}
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
            {!isSignUp && (
              <div className="text-right">
                <Button
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-sm text-primary hover:text-primary-dark"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Esqueci minha senha
                </Button>
              </div>
            )}
          </div>

          {isSignUp && (
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
          )}

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200"
            disabled={isLoading || (isSignUp && emailExists)}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {isSignUp ? 'Criando conta...' : 'Entrando...'}
              </div>
            ) : (
              <div className="flex items-center">
                <LogIn className="h-4 w-4 mr-2" />
                {isSignUp ? 'Criar Conta' : 'Entrar'}
              </div>
            )}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={onToggleMode}
              className="text-primary hover:text-primary-dark"
            >
              {isSignUp 
                ? 'Já tem uma conta? Entre aqui'
                : 'Não tem conta? Crie uma aqui'
              }
            </Button>
          </div>
        </form>

        <ForgotPasswordModal 
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      </CardContent>
    </Card>
  );
}