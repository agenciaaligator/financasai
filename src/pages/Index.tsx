import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Calendar, MessageSquare, BarChart3, Bell, Users } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  const scrollToLogin = () => {
    const loginSection = document.getElementById('login-section');
    loginSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">Meu Assessor</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollToLogin}
            >
              Login
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/plans')}
              className="bg-gradient-primary hover:shadow-primary"
            >
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-12 md:py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center px-4">
            {/* Texto Principal */}
            <div className="space-y-6">
              <div className="inline-block">
                <span className="text-sm font-semibold text-primary uppercase tracking-wide bg-primary/10 px-3 py-1 rounded-full">
                  Controle Total
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Tenha um assessor pessoal{" "}
                <span className="text-primary">trabalhando 24h</span> por você
              </h1>
              <p className="text-muted-foreground text-lg">
                Organize finanças, compromissos, lembretes e WhatsApp em um painel inteligente que
                trabalha por você o tempo todo.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => navigate('/plans')}
                  className="bg-gradient-primary hover:shadow-primary"
                >
                  Começar grátis
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={scrollToLogin}
                >
                  Já tenho conta
                </Button>
              </div>
            </div>

            {/* Formulário de Login */}
            <div id="login-section" className="scroll-mt-20">
              <LoginForm />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Tudo que você precisa em um só lugar</h2>
              <p className="text-muted-foreground text-lg">
                Recursos poderosos para gerenciar sua vida pessoal e profissional
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="p-3 bg-gradient-primary rounded-lg w-fit mb-4">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Controle Financeiro</h3>
                  <p className="text-muted-foreground">
                    Acompanhe receitas, despesas e tenha relatórios completos do seu dinheiro.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="p-3 bg-gradient-primary rounded-lg w-fit mb-4">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Agenda Inteligente</h3>
                  <p className="text-muted-foreground">
                    Sincronize com Google Calendar e receba lembretes automáticos.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="p-3 bg-gradient-primary rounded-lg w-fit mb-4">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">WhatsApp Integrado</h3>
                  <p className="text-muted-foreground">
                    Registre transações e compromissos direto pelo WhatsApp.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="p-3 bg-gradient-primary rounded-lg w-fit mb-4">
                    <Bell className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Lembretes Automáticos</h3>
                  <p className="text-muted-foreground">
                    Nunca mais esqueça um compromisso ou pagamento importante.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="p-3 bg-gradient-primary rounded-lg w-fit mb-4">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Multi-usuário</h3>
                  <p className="text-muted-foreground">
                    Compartilhe e colabore com sua equipe ou família.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardContent className="pt-6">
                  <div className="p-3 bg-gradient-primary rounded-lg w-fit mb-4">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Fácil de Usar</h3>
                  <p className="text-muted-foreground">
                    Interface intuitiva e moderna para você começar em minutos.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-16 bg-gradient-primary text-white">
          <div className="max-w-4xl mx-auto text-center px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para ter seu assessor pessoal?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Comece gratuitamente e descubra como é ter controle total da sua vida.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/plans')}
              className="bg-white text-primary hover:bg-white/90 shadow-lg"
            >
              Criar conta grátis
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Meu Assessor. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, loading: loadingSubscription } = useSubscription();

  // Redirecionar usuários sem plano para a página de planos
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
    const isRecovery = searchParams.get('recovery') === 'true';
    const hasAccessToken = searchParams.get('access_token');
    const hasRefreshToken = searchParams.get('refresh_token');
    const hasRecoveryType = searchParams.get('type') === 'recovery';
    
    // Se há tokens de auth OU parâmetro recovery, redirecionar imediatamente
    if (hasAccessToken || hasRefreshToken || hasRecoveryType || isRecovery) {
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
          localStorage.removeItem('recovery_flow');
          navigate('/reset-password', { replace: true });
          return;
        } else {
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
    return <LandingPage />;
  }

  return <FinancialDashboard />;
};

export default Index;
