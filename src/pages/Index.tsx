import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/LoginForm";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Detectar se chegou via link de recovery do Supabase
  useEffect(() => {
    if (user && !loading) {
      // Verificar se há parâmetros de recovery na URL ou se acabou de fazer login via recovery
      const hasRecoveryParams = searchParams.get('type') === 'recovery' || 
                                searchParams.get('access_token') || 
                                window.location.href.includes('recovery');
      
      if (hasRecoveryParams) {
        console.log('Usuário logado detectado com parâmetros de recovery - redirecionando para reset-password');
        navigate('/reset-password', { replace: true });
      }
    }
  }, [user, loading, navigate, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <LoginForm 
          onToggleMode={() => setIsSignUp(!isSignUp)}
          isSignUp={isSignUp}
        />
      </div>
    );
  }

  return <FinancialDashboard />;
};

export default Index;
