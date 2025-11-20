import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, Bell, Shield, Smartphone, Zap, RefreshCw, BarChart3, Brain, Menu } from "lucide-react";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/auth/LoginForm";
import { PlansSection } from "@/components/PlansSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { FAQSection } from "@/components/FAQSection";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const LandingPage = () => {
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className={`
        sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b
        transition-shadow duration-300
        ${scrolled ? 'shadow-lg' : ''}
      `}>
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
            <Button variant="outline" onClick={() => setShowLogin(true)} className="hidden sm:flex">
              Entrar
            </Button>
            <Button onClick={() => navigate('/cadastro')} className="hidden sm:flex">
              Criar conta
            </Button>
            
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <nav className="flex flex-col gap-4 mt-8">
                  <a href="#home" className="text-lg hover:text-primary transition-colors">Home</a>
                  <a href="#como-funciona" className="text-lg hover:text-primary transition-colors">Como funciona</a>
                  <a href="#planos" className="text-lg hover:text-primary transition-colors">Planos</a>
                  <a href="#contato" className="text-lg hover:text-primary transition-colors">Contato</a>
                  <div className="flex flex-col gap-2 mt-4">
                    <Button variant="outline" onClick={() => setShowLogin(true)} className="w-full">
                      Entrar
                    </Button>
                    <Button onClick={() => navigate('/cadastro')} className="w-full">
                      Criar conta
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
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

      <section id="home" className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-left">
            <h1 className="text-4xl md:text-6xl font-bold">
              Tenha um assessor pessoal trabalhando{' '}
              <span className="text-primary">24h por dia</span> por você
            </h1>
            <p className="text-xl text-muted-foreground">
              Gerencie suas finanças e compromissos de forma inteligente com a Dona Wilma
            </p>
            <div className="flex gap-4">
              <Button 
                size="lg" 
                onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Ver planos
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Saiba mais
              </Button>
            </div>
          </div>
          
          <div className="hidden md:flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
              <div className="relative bg-card p-8 rounded-2xl shadow-2xl border-2 border-primary/20">
                <Calendar className="h-48 w-48 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">Como funciona</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Simplifique sua vida com tecnologia que trabalha por você
        </p>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Gestão de Compromissos</CardTitle>
              </div>
              <CardDescription>
                Nunca mais perca um compromisso importante
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mt-0.5">
                    <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">WhatsApp Integrado</h4>
                    <p className="text-sm text-muted-foreground">
                      Adicione e receba lembretes diretamente no seu WhatsApp
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg mt-0.5">
                    <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Lembretes Inteligentes</h4>
                    <p className="text-sm text-muted-foreground">
                      Notificações automáticas no horário ideal para você
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mt-0.5">
                    <RefreshCw className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Sincronização Google Calendar</h4>
                    <p className="text-sm text-muted-foreground">
                      Conecte sua agenda e mantenha tudo sincronizado em tempo real
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Controle Financeiro</CardTitle>
              </div>
              <CardDescription>
                Tenha visão completa das suas finanças
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mt-0.5">
                    <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Painel Completo</h4>
                    <p className="text-sm text-muted-foreground">
                      Visualize receitas, despesas e saldo em tempo real
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg mt-0.5">
                    <Brain className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Relatórios com IA</h4>
                    <p className="text-sm text-muted-foreground">
                      Análises inteligentes dos seus padrões de gastos
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg mt-0.5">
                    <Shield className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">100% Seguro</h4>
                    <p className="text-sm text-muted-foreground">
                      Seus dados protegidos com criptografia de ponta
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="depoimentos" className="container mx-auto px-4 py-16 bg-muted/30">
        <h2 className="text-3xl font-bold text-center mb-3">
          O que nossos clientes dizem
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Milhares de pessoas já confiam na Dona Wilma
        </p>
        <TestimonialsSection />
      </section>

      <section id="planos" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Escolha seu plano</h2>
        <p className="text-center text-muted-foreground mb-12">
          Comece gratuitamente e faça upgrade quando precisar
        </p>
        <PlansSection />
      </section>

      <section id="faq" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">
          Perguntas frequentes
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Tire suas dúvidas sobre a Dona Wilma
        </p>
        <div className="max-w-3xl mx-auto">
          <FAQSection />
        </div>
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
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground space-y-2">
            <p>© 2024 Dona Wilma. Todos os direitos reservados.</p>
            <p>
              Desenvolvido por{' '}
              <a 
                href="https://aligator.com.br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-semibold transition-colors"
              >
                Aligator
              </a>
            </p>
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
