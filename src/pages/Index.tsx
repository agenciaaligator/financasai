import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, Bell, Shield, Smartphone, Zap } from "lucide-react";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/auth/LoginForm";
import { PlansSection } from "@/components/PlansSection";
import { Loader2 } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <a href="#home" className="text-sm hover:text-primary transition-colors">Home</a>
            <a href="#como-funciona" className="text-sm hover:text-primary transition-colors">Como funciona</a>
            <a href="#planos" className="text-sm hover:text-primary transition-colors">Planos</a>
            <a href="#contato" className="text-sm hover:text-primary transition-colors">Contato</a>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowLogin(true)}>
              Entrar
            </Button>
            <Button onClick={() => navigate('/cadastro')}>
              Criar conta
            </Button>
          </div>
        </nav>
      </header>

      {showLogin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="relative">
            <Button 
              variant="ghost" 
              className="absolute -top-2 -right-2 z-10"
              onClick={() => setShowLogin(false)}
            >
              ✕
            </Button>
            <LoginForm />
          </div>
        </div>
      )}

      <section id="home" className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Tenha um assessor pessoal trabalhando{' '}
          <span className="text-primary">24h por dia</span> por você
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Gerencie suas finanças e compromissos de forma inteligente com a Dona Wilma
        </p>
        <Button 
          size="lg" 
          onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Ver planos
        </Button>
      </section>

      <section id="como-funciona" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Como funciona</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-primary" />
                <CardTitle>Gestão de Compromissos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Lembretes automáticos via WhatsApp</span>
                </li>
                <li className="flex items-start gap-2">
                  <Smartphone className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Integração com Google Calendar</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Notificações inteligentes</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <CardTitle>Controle Financeiro</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <DollarSign className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Rastreamento de receitas e despesas</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Relatórios detalhados com IA</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Análise de padrões de gastos</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="planos" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Escolha seu plano</h2>
        <p className="text-center text-muted-foreground mb-12">
          Comece gratuitamente e faça upgrade quando precisar
        </p>
        <PlansSection />
      </section>

      <footer id="contato" className="bg-muted/30 mt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-6 w-6 text-primary" />
                <span className="font-bold text-lg">Dona Wilma</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Seu assessor pessoal para finanças e compromissos
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Links</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#home" className="hover:text-primary">Home</a></li>
                <li><a href="#como-funciona" className="hover:text-primary">Como funciona</a></li>
                <li><a href="#planos" className="hover:text-primary">Planos</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Contato</h3>
              <p className="text-sm text-muted-foreground">
                contato@donawilma.com.br
              </p>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 Dona Wilma. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

const Index = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <LandingPage />;
  }
  
  return <FinancialDashboard />;
};

export default Index;
