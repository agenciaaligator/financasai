import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Bell, Shield, Smartphone, Zap, RefreshCw, BarChart3, Brain, Menu, Users, FolderOpen, Clock } from "lucide-react";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/auth/LoginForm";
import { PlansSection } from "@/components/PlansSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { FAQSection } from "@/components/FAQSection";
import { FeatureBlock } from "@/components/FeatureBlock";
import { InteractionExamplesSection } from "@/components/InteractionExamplesSection";
import { StatsSection } from "@/components/StatsSection";
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

      <section id="como-funciona" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Como funciona</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Simplifique sua vida com tecnologia que trabalha por você
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          {/* Bloco 1: Controle Financeiro no WhatsApp */}
          <FeatureBlock
            title="FINANCEIRO"
            subtitle="Controle Financeiro no WhatsApp"
            description="Registre receitas e despesas com mensagens como 'gastei 50 reais no mercado' ou 'recebi 2 mil de salário' direto no WhatsApp. A IA entende, categoriza e registra tudo automaticamente."
            highlights={[
              "Categorização inteligente com IA",
              "Relatórios por categoria",
              "Integração com o painel web"
            ]}
            imageSrc="/images/landing/whatsapp-financeiro.png"
            imageAlt="WhatsApp processando transação financeira"
            imagePosition="left"
            icon={<DollarSign className="h-6 w-6 text-primary" />}
          />

          {/* Bloco 2: Gestão de Compromissos */}
          <FeatureBlock
            title="COMPROMISSOS"
            subtitle="Gestão de Compromissos por mensagem"
            description="Agende reuniões, consultas ou lembretes apenas digitando mensagens como 'reunião amanhã às 14h'. A agenda será criada automaticamente e sincronizada com o painel e Google Calendar."
            highlights={[
              "Agendamento por texto ou áudio",
              "Sincronização com Google Agenda",
              "Receba lembretes automáticos"
            ]}
            imageSrc="/images/landing/whatsapp-compromissos.png"
            imageAlt="WhatsApp mostrando compromissos do dia"
            imagePosition="right"
            icon={<Calendar className="h-6 w-6 text-primary" />}
          />

          {/* Bloco 3: Registre tudo no WhatsApp */}
          <FeatureBlock
            title="REGISTROS"
            subtitle="Registre tudo no WhatsApp"
            description="Envie uma mensagem e nosso assistente lança tudo automaticamente."
            highlights={[
              "Texto ou áudio, você escolhe",
              "Categorização inteligente",
              "Rápido, prático e sem complicação"
            ]}
            imageSrc="/images/landing/whatsapp-registros.png"
            imageAlt="Interface do WhatsApp"
            imagePosition="left"
            icon={<Smartphone className="h-6 w-6 text-primary" />}
          />

          {/* Bloco 4: Painel Profissional */}
          <FeatureBlock
            title="PAINEL"
            subtitle="Painel Profissional"
            description="Visualize relatórios, gráficos e detalhes de suas transações com poucos cliques. Tudo organizado automaticamente, sem cadastro manual."
            highlights={[
              "Gráficos de fluxo de caixa",
              "Visão por categoria",
              "Detalhamento por período",
              "Prático e acessível"
            ]}
            imageSrc="/images/landing/dashboard-painel.png"
            imageAlt="Dashboard financeiro"
            imagePosition="right"
            icon={<BarChart3 className="h-6 w-6 text-primary" />}
          />

          {/* Bloco 5: Compartilhe sua conta */}
          <FeatureBlock
            title="COMPARTILHAMENTO"
            subtitle="Compartilhe sua conta com quem quiser"
            description="Família ou empresa. Todos podem registrar com você."
            highlights={[
              "Usuários ilimitados",
              "Controle compartilhado"
            ]}
            imageSrc="/images/landing/compartilhamento.png"
            imageAlt="Gestão de membros"
            imagePosition="left"
            icon={<Users className="h-6 w-6 text-primary" />}
          />

          {/* Bloco 6: Categorias Personalizadas */}
          <FeatureBlock
            title="CATEGORIAS"
            subtitle="Categorias Personalizadas"
            description="Use as que já vêm prontas ou crie quantas quiser."
            highlights={[
              "Ilimitadas categorias",
              "Relatórios com IA",
              "Cadastro automático no WhatsApp"
            ]}
            imageSrc="/images/landing/categorias.png"
            imageAlt="Categorias personalizadas"
            imagePosition="right"
            icon={<FolderOpen className="h-6 w-6 text-primary" />}
          />

          {/* Bloco 7: Lembretes Diários */}
          <FeatureBlock
            title="LEMBRETES"
            subtitle="Lembretes Diários via WhatsApp"
            description="Seu assessor te avisa sobre contas a pagar e compromissos — todo dia à manhã e 30 minutos antes de cada evento."
            highlights={[
              "Avisos diários e antecipados",
              "Ideal para cobranças, metas, aniversários",
              "Contas a pagar e receber"
            ]}
            imageSrc="/images/landing/lembretes.png"
            imageAlt="Lembretes no WhatsApp"
            imagePosition="left"
            icon={<Bell className="h-6 w-6 text-primary" />}
          />

          {/* Bloco 8: Integração Google Agenda */}
          <FeatureBlock
            title="INTEGRAÇÃO"
            subtitle="Integração com Google Agenda"
            description="Agora você pode integrar seus compromissos automaticamente com o Google Agenda. A Dona Wilma será sincronizada em tempo real com sua agenda pessoal ou profissional."
            highlights={[
              "Sincronização automática dos compromissos",
              "Receba lembretes automáticos no WhatsApp",
              "Organização e produtividade no seu dia a dia"
            ]}
            imageSrc="/images/landing/google-calendar-integration.png"
            imageAlt="Integração com Google Calendar"
            imagePosition="right"
            icon={<RefreshCw className="h-6 w-6 text-primary" />}
          />
        </div>
      </section>

      {/* Interaja 24h com IA */}
      <InteractionExamplesSection />

      <section id="depoimentos" className="container mx-auto px-4 py-20 bg-muted/30">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
          O que nossos clientes dizem
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Milhares de pessoas já confiam na Dona Wilma
        </p>
        <TestimonialsSection />
      </section>

      {/* Stats Section */}
      <StatsSection />

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
  const navigate = useNavigate();
  
  // 🔥 DETECTAR PENDING CHECKOUT APÓS CONFIRMAÇÃO DE EMAIL
  useEffect(() => {
    if (user) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('pending_checkout') === 'true') {
        const cycle = searchParams.get('cycle') || 'monthly';
        const coupon = searchParams.get('coupon') || '';
        
        console.log('[INDEX] Checkout pendente detectado:', { cycle, coupon, user: user.id });
        
        // Remover params da URL
        searchParams.delete('pending_checkout');
        window.history.replaceState({}, '', `${window.location.pathname}?${searchParams.toString()}`);
        
        // Redirecionar para checkout
        if (coupon) {
          // Ativar trial via cupom
          navigate(`/?coupon=${coupon}`);
        } else {
          // Ir para página de checkout
          navigate(`/?tab=subscription&cycle=${cycle}`);
        }
      }
    }
  }, [user, navigate]);
  
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
