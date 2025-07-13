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
    const currentUrl = window.location.href;
    console.log('Index.tsx - URL atual:', currentUrl);
    console.log('Index.tsx - SearchParams:', Object.fromEntries(searchParams.entries()));
    console.log('Index.tsx - User:', user);
    console.log('Index.tsx - Loading:', loading);

    // Verificar IMEDIATAMENTE se há tokens de recovery na URL, mesmo sem usuário logado
    const hasAccessToken = searchParams.get('access_token');
    const hasRefreshToken = searchParams.get('refresh_token');
    const hasRecoveryType = searchParams.get('type') === 'recovery';
    
    if (hasAccessToken || hasRefreshToken || hasRecoveryType) {
      console.log('DETECTADO: Parâmetros de recovery na URL - redirecionando IMEDIATAMENTE para reset-password');
      navigate('/reset-password' + window.location.search, { replace: true });
      return;
    }

    // Se usuário está logado mas não tem parâmetros de recovery, verificar se é um login recente via recovery
    if (user && !loading) {
      const userCreatedAt = new Date(user.created_at || '').getTime();
      const now = Date.now();
      const timeDiff = now - userCreatedAt;
      
      // Se o usuário foi criado/logado nos últimos 2 minutos, pode ser recovery
      if (timeDiff < 120000) {
        console.log('Usuário logado recentemente - pode ser via recovery, redirecionando');
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
