import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Shield, Smartphone, Zap, BarChart3, Brain, Menu, FolderOpen, Sparkles } from "lucide-react";
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
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { GracePeriodBanner } from "@/components/GracePeriodBanner";
import SubscriptionInactive from "@/pages/SubscriptionInactive";

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showLogin, setShowLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Scroll detection for nav
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll reveal with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.08, rootMargin: '-40px 0px' }
    );

    const elements = document.querySelectorAll('.scroll-reveal');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Animated background */}
      <div className="animated-bg" />

      {/* Navigation */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'glass-nav-scrolled' : 'glass-nav'}`}>
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src="/images/logo.png" alt="Dona Wilma" className="h-8" />
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-sm font-medium text-foreground/80 hover:text-primary transition-all duration-200 hover:-translate-y-0.5">Home</a>
            <a href="#como-funciona" className="text-sm font-medium text-foreground/80 hover:text-primary transition-all duration-200 hover:-translate-y-0.5">{t('landing.nav.howItWorks')}</a>
            <a href="#planos" className="text-sm font-medium text-foreground/80 hover:text-primary transition-all duration-200 hover:-translate-y-0.5">{t('landing.nav.plans')}</a>
            <a href="#contato" className="text-sm font-medium text-foreground/80 hover:text-primary transition-all duration-200 hover:-translate-y-0.5">{t('landing.nav.contact')}</a>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <LanguageFlagSelector />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowLogin(true)} 
              className="font-medium hover:-translate-y-0.5 transition-transform"
            >
              {t('auth.login')}
            </Button>
            
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="glass-card">
                <nav className="flex flex-col gap-4 mt-8">
                  <button onClick={() => { setSheetOpen(false); setTimeout(() => scrollToSection('home'), 300); }} className="text-lg font-medium hover:text-primary transition-colors text-left">Home</button>
                  <button onClick={() => { setSheetOpen(false); setTimeout(() => scrollToSection('como-funciona'), 300); }} className="text-lg font-medium hover:text-primary transition-colors text-left">{t('landing.nav.howItWorks')}</button>
                  <button onClick={() => { setSheetOpen(false); setTimeout(() => scrollToSection('planos'), 300); }} className="text-lg font-medium hover:text-primary transition-colors text-left">{t('landing.nav.plans')}</button>
                  <button onClick={() => { setSheetOpen(false); setTimeout(() => scrollToSection('contato'), 300); }} className="text-lg font-medium hover:text-primary transition-colors text-left">{t('landing.nav.contact')}</button>
                  <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-border">
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

      {/* Login modal */}
      {showLogin && (
        <div 
          className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('auth.login')}
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
        >
          <div className="relative animate-fadeInUp">
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute -top-3 -right-3 z-10 bg-background rounded-full shadow-md"
              onClick={() => setShowLogin(false)}
            >
              ✕
            </Button>
            <div className="flex justify-center mb-4">
              <img src="/images/logo.png" alt="Dona Wilma" className="h-12" />
            </div>
            <LoginForm />
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section id="home" className="container mx-auto px-4 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-8 text-left">
            {/* Hero badge */}
            <div className="hero-badge animate-fadeInUp">
              <Sparkles className="h-4 w-4" />
              <span>Inteligência Artificial para sua vida</span>
            </div>
            
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              {t('landing.hero.title')}{' '}
              <span className="gradient-text">{t('landing.hero.highlight')}</span>{' '}
              {t('landing.hero.titleEnd')}
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              {t('landing.hero.subtitle')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
              <Button 
                size="lg" 
                className="text-base font-semibold hover:-translate-y-1 transition-all duration-300 shadow-primary"
                onClick={() => scrollToSection('planos')}
              >
                {t('landing.hero.viewPlans')}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-base font-semibold hover:-translate-y-1 transition-all duration-300"
                onClick={() => scrollToSection('como-funciona')}
              >
                {t('landing.hero.learnMore')}
              </Button>
            </div>
            
            {/* Social proof */}
            <div className="flex items-center gap-4 pt-4 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
              <div className="flex -space-x-2">
                {['bg-primary', 'bg-secondary', 'bg-success'].map((bg, i) => (
                  <div key={i} className={`w-9 h-9 rounded-full ${bg} border-2 border-background shadow-sm`} />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">+500</span> usuários ativos
              </p>
            </div>
          </div>
          
          {/* Hero image */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-primary opacity-15 blur-[60px] rounded-full scale-110 group-hover:scale-125 group-hover:opacity-20 transition-all duration-700" />
              <img 
                src="/images/landing/hero-illustration.png" 
                alt="Dona Wilma - WhatsApp, Dashboard e Calendário integrados"
                className="relative w-full max-w-md rounded-3xl shadow-hero hover:scale-[1.02] transition-transform duration-500"
                loading="eager"
              />
              
              {/* Floating card - WhatsApp message */}
              <div className="absolute -bottom-6 -left-8 glass-card rounded-2xl p-4 shadow-card animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center">
                    <span className="text-xl">💬</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Gastei 50 no mercado</p>
                  </div>
                </div>
              </div>
              
              {/* Floating card - Success */}
              <div className="absolute -top-4 -right-6 glass-card rounded-2xl px-4 py-3 shadow-card animate-float" style={{ animationDelay: '1.5s' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <p className="text-xs font-semibold text-success">Registrado!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="container mx-auto px-4 py-20">
        <div className="text-center mb-20 scroll-reveal">
          <div className="section-line mx-auto mb-6" />
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{t('landing.nav.howItWorks')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('landing.howItWorks.subtitle')}
          </p>
        </div>

        <div className="max-w-7xl mx-auto space-y-8">
          <div className="scroll-reveal">
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
          </div>

          <div className="scroll-reveal delay-1">
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
          </div>

          <div className="scroll-reveal delay-2">
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
          </div>

          <div className="scroll-reveal delay-3">
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
        </div>
      </section>

      {/* Interação com IA */}
      <div className="scroll-reveal">
        <InteractionExamplesSection />
      </div>

      {/* Como funciona na prática */}
      <section id="depoimentos" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 scroll-reveal">
            <div className="section-line mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
              {t('landing.howItWorksPractice.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('landing.howItWorksPractice.subtitle')}
            </p>
          </div>
          <div className="scroll-reveal delay-1">
            <TestimonialsSection />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <div className="scroll-reveal">
        <StatsSection />
      </div>

      {/* Planos */}
      <section id="planos" className="container mx-auto px-4 py-20">
        <div className="text-center mb-8 scroll-reveal">
          <div className="section-line mx-auto mb-6" />
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">{t('landing.plans.title')}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('landing.plans.subtitle')}
          </p>
        </div>
        <div className="scroll-reveal delay-1">
          <PlansSection />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 scroll-reveal">
            <div className="section-line mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
              {t('landing.faq.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('landing.faq.subtitle')}
            </p>
          </div>
          <div className="max-w-3xl mx-auto scroll-reveal delay-1">
            <FAQSection />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="footer-dark mt-8">
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <div className="mb-5">
                <img src="/images/logo.png" alt="Dona Wilma" className="h-8 brightness-0 invert" />
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                {t('landing.footer.tagline')}
              </p>
            </div>
            <div>
              <h3 className="font-display font-semibold text-secondary mb-5">{t('landing.footer.links')}</h3>
              <ul className="space-y-3 text-sm text-white/60">
                <li><a href="#home" className="hover:text-white hover:translate-x-1 inline-block transition-all">Home</a></li>
                <li><a href="#como-funciona" className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.nav.howItWorks')}</a></li>
                <li><a href="#planos" className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.nav.plans')}</a></li>
                <li><a href="/termos" className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.footer.terms')}</a></li>
                <li><a href="/privacidade" className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.footer.privacy')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-display font-semibold text-secondary mb-5">{t('landing.nav.contact')}</h3>
              <p className="text-sm text-white/60">
                contato@donawilma.com.br
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm text-white/50 space-y-2">
            <p>{t('landing.footer.copyright')}</p>
            <p>
              {t('landing.footer.developedBy')}{' '}
              <a 
                href="https://aligator.com.br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-secondary hover:text-secondary/80 font-semibold transition-colors"
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

// Protected wrapper that checks password_set and subscription status
const ProtectedDashboard = () => {
  const navigate = useNavigate();
  const guard = useSubscriptionGuard();

  // Must set password first — useEffect before any early returns
  useEffect(() => {
    if (!guard.loading && guard.needsPassword) {
      navigate('/set-password', { replace: true });
    }
  }, [guard.loading, guard.needsPassword, navigate]);

  if (guard.loading || guard.needsPassword) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Subscription inactive and not in grace period
  if (!guard.canAccessDashboard && !guard.isMasterOrAdmin) {
    return <SubscriptionInactive />;
  }

  return (
    <>
      {guard.isInGracePeriod && (
        <GracePeriodBanner gracePeriodEndsAt={guard.gracePeriodEndsAt} />
      )}
      <FinancialDashboard />
    </>
  );
};

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkingFirstLogin, setCheckingFirstLogin] = useState(true);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (window.location.pathname !== '/') {
      setCheckingFirstLogin(false);
      return;
    }
    if (loading) return;
    if (!user) {
      setCheckingFirstLogin(false);
      return;
    }
    if (hasCheckedRef.current) {
      setCheckingFirstLogin(false);
      return;
    }
    
    const onboardingCompleted = sessionStorage.getItem('onboarding_completed') === 'true';
    
    if (onboardingCompleted) {
      hasCheckedRef.current = true;
      setCheckingFirstLogin(false);
      return;
    }
    
    const checkUserStatus = async () => {
      hasCheckedRef.current = true;
      
      const params = new URLSearchParams(window.location.search);
      const pendingCheckout = params.get('pending_checkout') === 'true';
      const storedPending = sessionStorage.getItem('pending_checkout') === 'true';
      
      if (pendingCheckout || storedPending) {
        sessionStorage.removeItem('pending_checkout');
        sessionStorage.removeItem('checkout_cycle');
        window.history.replaceState({}, '', window.location.pathname);
        toast({ title: "✅ Conta confirmada!", description: "Bem-vindo ao Dona Wilma!" });
      }
      
      const { data: whatsappSession } = await supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!whatsappSession) {
        sessionStorage.setItem('redirected_to_welcome', 'true');
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
  
  return <ProtectedDashboard />;
};

export default Index;
