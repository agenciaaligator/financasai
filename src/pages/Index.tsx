import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, loading: loadingSubscription } = useSubscription();

  // Redirecionar usuários sem plano para a landing page
  useEffect(() => {
    if (user && !loadingSubscription && !subscription) {
      navigate('/plans');
    }
  }, [user, loadingSubscription, subscription, navigate]);

  // Detectar logout forçado
  useEffect(() => {
    const forceLogout = sessionStorage.getItem('force_logout');
    
    if (forceLogout && user) {
      console.log('[INDEX] Logout forçado detectado - limpando estado...');
      sessionStorage.removeItem('force_logout');
      
      // Se ainda há usuário após logout, forçar limpeza
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  }, [user]);

  // Detectar se chegou via link de recovery do Supabase
  useEffect(() => {
    console.log('Index.tsx - URL atual:', window.location.href);
    console.log('Index.tsx - SearchParams:', Object.fromEntries(searchParams.entries()));
    console.log('Index.tsx - User:', user);
    console.log('Index.tsx - Loading:', loading);

    // Verificar se há parâmetro de recovery na URL
    const isRecovery = searchParams.get('recovery') === 'true';
    const recoveryTimestamp = searchParams.get('t');

    // Verificar parâmetros de auth do Supabase
    const hasAccessToken = searchParams.get('access_token');
    const hasRefreshToken = searchParams.get('refresh_token');
    const hasRecoveryType = searchParams.get('type') === 'recovery';
    
    // Se há tokens de auth OU parâmetro recovery, redirecionar imediatamente
    if (hasAccessToken || hasRefreshToken || hasRecoveryType || isRecovery) {
      console.log('DETECTADO: Parâmetros de recovery na URL - redirecionando para reset-password');
      
      // Marcar no localStorage que é um recovery
      if (isRecovery || hasRecoveryType) {
        localStorage.setItem('recovery_flow', Date.now().toString());
      }
      
      // Se tem tokens, preservar na URL do reset
      if (hasAccessToken || hasRefreshToken || hasRecoveryType) {
        navigate('/reset-password' + window.location.search, { replace: true });
      } else {
        navigate('/reset-password', { replace: true });
      }
      return;
    }

    // Se usuário está logado, verificar se é um recovery recente
    if (user && !loading) {
      const recoveryMarker = localStorage.getItem('recovery_flow');
      
      if (recoveryMarker) {
        const recoveryTime = parseInt(recoveryMarker);
        const now = Date.now();
        
        // Se o recovery foi marcado nos últimos 30 segundos
        if (now - recoveryTime < 30000) {
          console.log('Usuário logado após recovery recente - redirecionando');
          localStorage.removeItem('recovery_flow'); // Limpar o marker
          navigate('/reset-password', { replace: true });
          return;
        } else {
          // Limpar marker antigo
          localStorage.removeItem('recovery_flow');
        }
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
        <LoginForm />
      </div>
    );
  }

  return <FinancialDashboard />;
};

export default Index;
