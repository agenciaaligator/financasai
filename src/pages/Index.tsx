import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Shield, Smartphone, Zap, BarChart3, Brain, Menu, FolderOpen } from "lucide-react";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LanguageFlagSelector } from "@/components/LanguageFlagSelector";
import { LoginForm } from "@/components/auth/LoginForm";
import { PlansSection } from "@/components/PlansSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { FAQSection } from "@/components/FAQSection";
import { FeatureBlock } from "@/components/FeatureBlock";
import { InteractionExamplesSection } from "@/components/InteractionExamplesSection";
import { StatsSection } from "@/components/StatsSection";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showLogin, setShowLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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
            <a href="#como-funciona" className="text-sm hover:text-primary transition-colors">{t('landing.nav.howItWorks')}</a>
            <a href="#planos" className="text-sm hover:text-primary transition-colors">{t('landing.nav.plans')}</a>
            <a href="#contato" className="text-sm hover:text-primary transition-colors">{t('landing.nav.contact')}</a>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <LanguageFlagSelector />
            </div>
            <Button variant="outline" onClick={() => setShowLogin(true)} className="hidden sm:flex">
              {t('auth.login')}
            </Button>
            
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <nav className="flex flex-col gap-4 mt-8">
                  <a href="#home" onClick={() => setSheetOpen(false)} className="text-lg hover:text-primary transition-colors">Home</a>
                  <a href="#como-funciona" onClick={() => setSheetOpen(false)} className="text-lg hover:text-primary transition-colors">{t('landing.nav.howItWorks')}</a>
                  <a href="#planos" onClick={() => setSheetOpen(false)} className="text-lg hover:text-primary transition-colors">{t('landing.nav.plans')}</a>
                  <a href="#contato" onClick={() => setSheetOpen(false)} className="text-lg hover:text-primary transition-colors">{t('landing.nav.contact')}</a>
                  <div className="flex flex-col gap-2 mt-4">
                    <LanguageFlagSelector inline onSelect={() => setSheetOpen(false)} />
                    <Button variant="outline" onClick={() => { setShowLogin(true); setSheetOpen(false); }} className="w-full">
                      {t('auth.login')}
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
              {t('landing.hero.title')}{' '}
              <span className="text-primary">{t('landing.hero.highlight')}</span> {t('landing.hero.titleEnd')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex gap-4">
              <Button 
                size="lg" 
                onClick={() => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' })}
              >
                {t('landing.hero.viewPlans')}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
              >
                {t('landing.hero.learnMore')}
              </Button>
            </div>
          </div>
          
          <div className="hidden md:flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
              <img 
                src="/images/landing/hero-illustration.png" 
                alt="Dona Wilma - WhatsApp, Dashboard e Calendário integrados"
                className="relative w-full max-w-md rounded-2xl shadow-2xl"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">{t('landing.nav.howItWorks')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.howItWorks.subtitle')}
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <FeatureBlock
            title={t('landing.features.financial.tag')}
            subtitle={t('landing.features.financial.title')}
            description={t('landing.features.financial.description')}
            highlights={[
              t('landing.features.financial.h1'),
              t('landing.features.financial.h2'),
              t('landing.features.financial.h3')
            ]}
            imageSrc="/images/landing/whatsapp-financeiro.png"
            imageAlt="WhatsApp processando transação financeira"
            imagePosition="left"
            icon={<DollarSign className="h-6 w-6 text-primary" />}
          />

          <FeatureBlock
            title={t('landing.features.records.tag')}
            subtitle={t('landing.features.records.title')}
            description={t('landing.features.records.description')}
            highlights={[
              t('landing.features.records.h1'),
              t('landing.features.records.h2'),
              t('landing.features.records.h3')
            ]}
            imageSrc="/images/landing/whatsapp-registros.png"
            imageAlt="Interface do WhatsApp"
            imagePosition="right"
            icon={<Smartphone className="h-6 w-6 text-primary" />}
          />

          <FeatureBlock
            title={t('landing.features.dashboard.tag')}
            subtitle={t('landing.features.dashboard.title')}
            description={t('landing.features.dashboard.description')}
            highlights={[
              t('landing.features.dashboard.h1'),
              t('landing.features.dashboard.h2'),
              t('landing.features.dashboard.h3'),
              t('landing.features.dashboard.h4')
            ]}
            imageSrc="/images/landing/dashboard-painel.png"
            imageAlt="Dashboard financeiro"
            imagePosition="left"
            icon={<BarChart3 className="h-6 w-6 text-primary" />}
          />

          <FeatureBlock
            title={t('landing.features.categories.tag')}
            subtitle={t('landing.features.categories.title')}
            description={t('landing.features.categories.description')}
            highlights={[
              t('landing.features.categories.h1'),
              t('landing.features.categories.h2'),
              t('landing.features.categories.h3')
            ]}
            imageSrc="/images/landing/categorias.png"
            imageAlt="Categorias personalizadas"
            imagePosition="right"
            icon={<FolderOpen className="h-6 w-6 text-primary" />}
          />
        </div>
      </section>

      {/* Interaja 24h com IA */}
      <InteractionExamplesSection />

      <section id="depoimentos" className="container mx-auto px-4 py-20 bg-muted/30">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
          {t('landing.howItWorksPractice.title')}
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          {t('landing.howItWorksPractice.subtitle')}
        </p>
        <TestimonialsSection />
      </section>

      {/* Stats Section */}
      <StatsSection />

      <section id="planos" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">{t('landing.plans.title')}</h2>
        <p className="text-center text-muted-foreground mb-12">
          {t('landing.plans.subtitle')}
        </p>
        <PlansSection />
      </section>

      <section id="faq" className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">
          {t('landing.faq.title')}
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          {t('landing.faq.subtitle')}
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
                {t('landing.footer.tagline')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('landing.footer.links')}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#home" className="hover:text-primary">Home</a></li>
                <li><a href="#como-funciona" className="hover:text-primary">{t('landing.nav.howItWorks')}</a></li>
                <li><a href="#planos" className="hover:text-primary">{t('landing.nav.plans')}</a></li>
                <li><a href="/termos" className="hover:text-primary">{t('landing.footer.terms')}</a></li>
                <li><a href="/privacidade" className="hover:text-primary">{t('landing.footer.privacy')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">{t('landing.nav.contact')}</h3>
              <p className="text-sm text-muted-foreground">
                contato@donawilma.com.br
              </p>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground space-y-2">
            <p>{t('landing.footer.copyright')}</p>
            <p>
              {t('landing.footer.developedBy')}{' '}
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
  const { toast } = useToast();
  const [checkingFirstLogin, setCheckingFirstLogin] = useState(true);
  const hasCheckedRef = useRef(false); // useRef persiste entre re-renders sem causar loops
  
  // 🔥 DETECTAR PENDING CHECKOUT E VERIFICAR PRIMEIRO LOGIN
  useEffect(() => {
    // PRIMEIRO: Verificar se estamos na rota correta
    if (window.location.pathname !== '/') {
      setCheckingFirstLogin(false);
      return;
    }
    
    // Se ainda está carregando auth, aguardar
    if (loading) return;
    
    // Se não está logado, mostrar landing page
    if (!user) {
      setCheckingFirstLogin(false);
      return;
    }
    
    // Evitar múltiplas execuções usando useRef (persiste entre re-mounts)
    if (hasCheckedRef.current) {
      setCheckingFirstLogin(false);
      return;
    }
    
    // VERIFICAÇÃO SÍNCRONA - se já completou onboarding OU já foi redirecionado
    const onboardingCompleted = sessionStorage.getItem('onboarding_completed') === 'true';
    const alreadyRedirected = sessionStorage.getItem('redirected_to_welcome') === 'true';
    
    if (onboardingCompleted || alreadyRedirected) {
      hasCheckedRef.current = true;
      setCheckingFirstLogin(false);
      return;
    }
    
    const checkUserStatus = async () => {
      hasCheckedRef.current = true; // Marcar ANTES de qualquer async
      
      const params = new URLSearchParams(window.location.search);
      const pendingCheckout = params.get('pending_checkout') === 'true';
      const storedPending = sessionStorage.getItem('pending_checkout') === 'true';
      
      if (pendingCheckout || storedPending) {
        console.log('[CHECKOUT] Detectado pending_checkout após confirmação de email');
        
        // Limpar flags e URL
        sessionStorage.removeItem('pending_checkout');
        sessionStorage.removeItem('checkout_cycle');
        window.history.replaceState({}, '', window.location.pathname);
        
        toast({
          title: "✅ Conta confirmada!",
          description: "Bem-vindo ao Dona Wilma!",
        });
      }
      
      // Verificar se já existe sessão WhatsApp válida
      const { data: whatsappSession } = await supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (!whatsappSession) {
        console.log('[FIRST LOGIN] Usuário sem WhatsApp, redirecionando para /boas-vindas');
        sessionStorage.setItem('redirected_to_welcome', 'true'); // Marcar ANTES de redirecionar
        navigate('/boas-vindas', { replace: true });
        return;
      }
      
      setCheckingFirstLogin(false);
    };
    
    checkUserStatus();
  }, [user, loading, navigate, toast]);
  
  if (loading || (user && checkingFirstLogin)) {
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
