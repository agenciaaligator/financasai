import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await signIn(email, password);
      
      // Se login bem-sucedido, limpar campos de senha
      if (result && !result.error) {
        setPassword('');
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
          Entrar
        </CardTitle>
        <p className="text-muted-foreground">
          Entre em sua conta para acessar o dashboard
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Entrando...
              </div>
            ) : (
              <div className="flex items-center">
                <LogIn className="h-4 w-4 mr-2" />
                Entrar
              </div>
            )}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => navigate('/signup')}
              className="text-primary hover:text-primary-dark"
            >
              Não tem conta? Crie uma aqui
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
