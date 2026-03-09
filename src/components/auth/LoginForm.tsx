import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmailConfirmedBanner, setShowEmailConfirmedBanner] = useState(false);
  const { signIn } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const flag = sessionStorage.getItem('came_from_email_confirmation');
    if (flag) {
      setShowEmailConfirmedBanner(true);
      sessionStorage.removeItem('came_from_email_confirmation');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const result = await signIn(email, password);
      
      if (result && !result.error) {
        setPassword('');
        setErrorMessage(null);
        navigate('/', { replace: true });

        // Background: update password_set (non-blocking)
        supabase.auth.getUser().then(({ data: { user: loggedUser } }) => {
          if (loggedUser) {
            supabase.from('profiles').update({ password_set: true }).eq('user_id', loggedUser.id);
          }
        });
      } else if (result?.error) {
        if (result.error.message.includes('Invalid login credentials')) {
          setErrorMessage('invalid_credentials');
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
          {t('auth.login')}
        </CardTitle>
        <p className="text-muted-foreground">
          {t('login.enterToAccess')}
        </p>
      </CardHeader>
      <CardContent>
        {showEmailConfirmedBanner && (
          <Alert className="mb-4 border-green-500/50 bg-green-50 dark:bg-green-950/30">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              {t('login.emailConfirmedBanner')}
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
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
                {t('auth.forgotPassword')}
              </Button>
            </div>
          </div>

          {errorMessage === 'invalid_credentials' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('login.invalidCredentials')}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{t('login.checkCredentials')}</p>
                <div className="flex flex-col gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForgotPassword(true)}
                    className="w-full"
                  >
                    {t('auth.forgotPassword')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/choose-plan')}
                    className="w-full"
                  >
                    {t('login.noAccount')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('login.loggingIn')}
              </div>
            ) : (
              <div className="flex items-center">
                <LogIn className="h-4 w-4 mr-2" />
                {t('auth.login')}
              </div>
            )}
          </Button>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-center text-muted-foreground mb-3">
              {t('login.noAccountYet')}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/choose-plan')}
              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {t('login.createAccount')}
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
