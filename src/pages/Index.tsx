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
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between py-4 px-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl text-primary">Meu Assessor</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={scrollToLogin}
            >
              Login
            </Button>
            <Button
              onClick={() => navigate("/plans")}
              className="bg-primary text-primary-foreground"
            >
              Criar conta
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 md:py-20 bg-gradient-to-b from-primary/5 to-background">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center px-4 md:px-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-primary uppercase tracking-wide">
                Controle financeiro, compromissos e lembretes em um só lugar
              </p>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                Tenha um assessor pessoal <br />
                <span className="text-primary">trabalhando 24h por dia</span> por você
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-xl">
                Organize finanças, compromissos, lembretes e WhatsApp em um painel inteligente que
                trabalha por você o tempo todo.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={() => navigate("/plans")}
                  size="lg"
                  className="bg-primary text-primary-foreground"
                >
                  Começar grátis
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={scrollToLogin}
                >
                  Já tenho conta
                </Button>
              </div>
            </div>

            <div id="login-section" className="space-y-4">
              <LoginForm />
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4 md:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Tudo o que você precisa em um só lugar
              </h2>
              <p className="text-muted-foreground text-lg">
                Simplifique sua vida com recursos poderosos
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Controle Financeiro</h3>
                  <p className="text-muted-foreground">
                    Gerencie suas finanças com relatórios detalhados e gráficos intuitivos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Google Calendar</h3>
                  <p className="text-muted-foreground">
                    Sincronize seus compromissos e nunca perca um evento importante
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">WhatsApp</h3>
                  <p className="text-muted-foreground">
                    Registre transações e compromissos direto pelo WhatsApp
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Lembretes Inteligentes</h3>
                  <p className="text-muted-foreground">
                    Receba notificações no momento certo para não esquecer nada
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Relatórios com IA</h3>
                  <p className="text-muted-foreground">
                    Análises inteligentes dos seus dados financeiros e compromissos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Multi-usuário</h3>
                  <p className="text-muted-foreground">
                    Compartilhe e colabore com sua equipe ou família
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gradient-to-b from-background to-primary/5">
          <div className="max-w-4xl mx-auto text-center px-4 md:px-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para simplificar sua vida?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Comece agora gratuitamente e descubra como é ter um assessor pessoal 24h por dia
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/plans")}
              className="bg-primary text-primary-foreground"
            >
              Começar agora
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-muted-foreground">
          <p>&copy; 2024 Meu Assessor. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

const Index = () => {
  const { user, loading } = useAuth();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handlePasswordRecovery = async () => {
      const accessToken = searchParams.get('access_token');
      const type = searchParams.get('type');
      
      if (type === 'recovery' && accessToken) {
        navigate('/reset-password');
      }
    };

    handlePasswordRecovery();
  }, [searchParams, navigate]);

  useEffect(() => {
    if (!loading && !subscriptionLoading && user && !subscription) {
      navigate("/plans");
    }
  }, [user, subscription, loading, subscriptionLoading, navigate]);

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
