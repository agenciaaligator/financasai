// ⚠️ RECOVERY FLOW (4/4) — Este componente faz parte de uma cadeia de 4 arquivos:
//   index.html → main.tsx → App.tsx → ResetPassword.tsx
// Lê o hash de recovery do sessionStorage (capturado pelo index.html),
// registra um listener de auth, e como fallback usa setSession() com tokens
// manuais extraídos do hash.
// NÃO altere este componente sem verificar os outros 3 arquivos.

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { updatePassword, user, session } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Detect if this is "set password" (new user) or "reset password" (existing user)
  const isSetPassword = location.pathname === '/set-password';

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let resolved = false;

    const resolve = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      setSessionEstablished(true);
      setIsInitializing(false);
    };

    const reject = (reason: 'timeout' | 'invalid') => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      if (reason === 'timeout') {
        toast({
          title: "Estamos demorando para validar seu link",
          description: "Verifique sua conexão e tente novamente clicando no link do email.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Link inválido ou expirado",
          description: "Solicite um novo link de recuperação.",
          variant: "destructive",
        });
      }
      setIsInitializing(false);
      navigate('/');
    };

    // 1. Ler hash do sessionStorage (capturado no index.html antes do Supabase limpar) ou da URL
    const savedHash = sessionStorage.getItem('supabase_recovery_hash') || window.location.hash;

    // 2. Registrar listener PRIMEIRO (síncrono) para não perder o evento
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, sess) => {
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && sess) {
          resolve();
        }
      }
    );

    // 3. Fallbacks assíncronos
    const init = async () => {
      // 3a. Verificar sessão existente (para /set-password)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        resolve();
        return;
      }

      // 3b. Tentar parsear hash capturado manualmente
      // ⚠️ WORKAROUND: O Supabase SDK limpa o hash da URL antes do app React montar,
      // então precisamos ler o hash salvo pelo index.html no sessionStorage e chamar
      // setSession() manualmente com os tokens extraídos. Isso pode quebrar se o
      // Supabase SDK mudar o formato do hash ou o comportamento de setSession().
      // Monitorar ao atualizar @supabase/supabase-js.
      if (savedHash) {
        const params = new URLSearchParams(savedHash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            resolve();
            return;
          }
        }
      }
    };

    init();

    // 4. Timeout de segurança (15s — margem extra para conexões lentas no Brasil)
    timeout = setTimeout(() => {
      subscription.unsubscribe();
      reject('timeout');
    }, 15000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionEstablished) {
      toast({ title: "❌ Sessão inválida", description: "Solicite um novo link.", variant: "destructive" });
      return;
    }
    
    if (!password || !confirmPassword) {
      toast({ title: "⚠️ Campos obrigatórios", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "❌ Senhas não coincidem", description: "As senhas devem ser iguais.", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "🔒 Senha muito fraca", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await updatePassword(password);
      
      if (result && !result.error) {
        // Limpar flags de recovery do sessionStorage
        sessionStorage.removeItem('supabase_recovery');
        sessionStorage.removeItem('supabase_recovery_hash');
        sessionStorage.removeItem('supabase_recovery_path');
        
        // Mark password as set in profile and user_metadata
        if (user) {
          await supabase.from('profiles').update({ password_set: true }).eq('user_id', user.id);
          await supabase.auth.updateUser({ data: { password_set: true } });
        }
        
        setTimeout(() => {
          navigate('/boas-vindas');
        }, 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">{t('resetPassword.validating')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-primary rounded-full">
              <Lock className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isSetPassword ? t('resetPassword.setPasswordTitle') : t('resetPassword.resetPasswordTitle')}
          </CardTitle>
          <p className="text-muted-foreground">
            {isSetPassword ? t('resetPassword.setPasswordSubtitle') : t('resetPassword.resetPasswordSubtitle')}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('resetPassword.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="new-password"
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
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">{t('resetPassword.confirmPassword')}</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('resetPassword.settingPassword')}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Lock className="h-4 w-4 mr-2" />
                    {t('resetPassword.setPassword')}
                  </div>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/');
                }}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('resetPassword.backToLogin')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
