import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, Shield, Smartphone, Zap, BarChart3, Brain, Menu, FolderOpen, Sparkles, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { GracePeriodBanner } from "@/components/GracePeriodBanner";
import SubscriptionInactive from "@/pages/SubscriptionInactive";
import donaWilmaLandingHero from "@/assets/dona-wilma-landing-hero.jpg";
import donaWilmaRetrato from "@/assets/dona-wilma-retrato.jpg.asset.json";
import { BrandLogo } from "@/components/BrandLogo";

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Defensive: close any open overlays as soon as a user session exists
  useEffect(() => {
    if (user) {
      setShowLogin(false);
      setSheetOpen(false);
    }
  }, [user]);

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
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* Animated background */}
      <div className="animated-bg" />

      {/* Navigation */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'glass-nav-scrolled' : 'glass-nav'}`}>
        <nav className="container mx-auto px-4 h-[72px] flex items-center justify-between">
          <a href="#home" className="flex items-center group">
            <BrandLogo className="h-10 group-hover:scale-105 transition-transform" />
          </a>

          <div className="hidden md:flex items-center gap-8">
            <a href="#como-funciona" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">{t('landing.nav.howItWorks')}</a>
            <a href="#planos" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">{t('landing.nav.plans')}</a>
            <a href="#faq" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">Dúvidas</a>
            <a href="#contato" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">{t('landing.nav.contact')}</a>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <LanguageFlagSelector />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogin(true)}
              className="hidden sm:inline-flex font-semibold rounded-full border-border hover:border-primary"
            >
              {t('auth.login')}
            </Button>
            <Button
              size="sm"
              onClick={() => scrollToSection('planos')}
              className="hidden sm:inline-flex btn-mel font-bold rounded-full border-0 hover:text-primary"
            >
              {t('landing.hero.viewPlans')}
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
                    <Button variant="outline" onClick={() => { setShowLogin(true); setSheetOpen(false); }} className="w-full rounded-full">
                      {t('auth.login')}
                    </Button>
                    <Button onClick={() => { setSheetOpen(false); setTimeout(() => scrollToSection('planos'), 300); }} className="btn-mel w-full rounded-full font-bold border-0 hover:text-primary">
                      {t('landing.hero.viewPlans')}
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      {/* Login modal */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="max-w-md p-0 bg-transparent border-0 shadow-none">
          <div className="flex justify-center mb-4">
            <BrandLogo className="h-12" />
          </div>
          <LoginForm onSuccess={() => setShowLogin(false)} />
        </DialogContent>
      </Dialog>

      {/* Hero */}
      <section id="home" className="container mx-auto px-4 pt-16 pb-24 md:pt-20 md:pb-28">
        <div className="grid md:grid-cols-[1.05fr_.95fr] gap-12 lg:gap-14 items-center">
          <div className="space-y-6 text-left">
            <div className="eyebrow animate-fadeInUp"><span className="dot" /> Suas finanças pelo WhatsApp</div>

            <h1 className="font-heading text-[2.6rem] sm:text-5xl md:text-6xl lg:text-[4rem] leading-[1.05] tracking-tight text-primary animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              Manda no zap<br />
              que a <em className="italic text-[hsl(var(--mel-deep))] font-medium">Dona Wilma</em><br />
              anota pra você.
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              {t('landing.hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
              <Button
                size="lg"
                className="btn-mel font-bold rounded-full border-0 hover:text-primary text-base px-7 h-12"
                onClick={() => scrollToSection('planos')}
              >
                Falar com a Dona Wilma
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-border font-semibold hover:border-primary text-base px-7 h-12"
                onClick={() => scrollToSection('como-funciona')}
              >
                Ver como funciona
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
              <span className="text-success">✓</span>
              <span>Teste grátis · funciona no seu WhatsApp de sempre</span>
            </div>
          </div>

          {/* WhatsApp phone mock */}
          <div className="relative flex items-center justify-center">
            <div className="blob-mel" style={{ top: '-40px', right: '-40px' }} aria-hidden="true" />
            <div className="postit absolute z-30" style={{ top: '-14px', left: '-6px' }} aria-hidden="true">anotei aqui 😊</div>

            <div className="phone-frame relative z-20 w-[300px] max-w-full animate-fadeInUp" style={{ animationDelay: '0.3s' }} role="img" aria-label="Conversa de WhatsApp com a Dona Wilma">
              <div className="phone-screen">
                <div className="wa-head">
                  <div className="wa-avatar">W</div>
                  <div>
                    <div className="font-bold text-sm leading-tight">Dona Wilma</div>
                    <div className="text-[11px] opacity-75">online · cuidando das suas contas</div>
                  </div>
                </div>
                <div className="wa-body">
                  <div className="wa-bubble wa-bubble-me">Gastei 47 reais no mercado agora<span className="wa-time">14:02</span></div>
                  <div className="wa-bubble wa-bubble-her">Anotei, viu? <b>R$ 47,00</b> em Mercado 🛒. Esse mês você já tá em R$ 320 nessa categoria.<span className="wa-time">14:02</span></div>
                  <div className="wa-bubble wa-bubble-me">Nossa, tá alto<span className="wa-time">14:03</span></div>
                  <div className="wa-bubble wa-bubble-her">Tá sim, meu bem. Quer que eu te avise quando passar de R$ 400? 💚<span className="wa-time">14:03</span></div>
                  <div className="wa-bubble wa-bubble-me">Pode ser! E me lembra do aluguel dia 5<span className="wa-time">14:04</span></div>
                  <div className="wa-bubble wa-bubble-her">Deixa comigo. Dia 5 eu te aviso do <b>aluguel</b> bem cedinho ⏰<span className="wa-time">14:04</span></div>
                </div>
              </div>
            </div>

            <div className="postit absolute z-30 hidden sm:block" style={{ bottom: '-10px', right: '-8px', transform: 'rotate(-3deg)' }} aria-hidden="true">✓ conta paga</div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="strip">
        <div className="container mx-auto px-4 py-6 flex flex-wrap gap-x-10 gap-y-3 items-center justify-center text-center">
          <div className="strip-item"><MessageCircle className="h-5 w-5" /> Tudo pelo WhatsApp</div>
          <div className="strip-item"><Shield className="h-5 w-5" /> Seus dados protegidos</div>
          <div className="strip-item"><span className="font-heading text-xl text-white">24h</span> ela nunca dorme no ponto</div>
          <div className="strip-item"><Sparkles className="h-5 w-5" /> Sem baixar nada</div>
        </div>
      </div>



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

          <div className="scroll-reveal delay-3">
            <FeatureBlock
              title={t('landing.features.calendar.tag')}
              subtitle={t('landing.features.calendar.title')}
              description={t('landing.features.calendar.description')}
              highlights={[
                t('landing.features.calendar.h1'),
                t('landing.features.calendar.h2'),
                t('landing.features.calendar.h3'),
                t('landing.features.calendar.h4')
              ]}
              imageSrc="/images/landing/dashboard-painel.png"
              imageAlt="Compromissos integrados ao Google Agenda"
              imagePosition="left"
              icon={<Calendar className="h-6 w-6 text-primary" />}
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

      {/* Homage - Sobre a Dona Wilma */}
      <section id="sobre" className="py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto scroll-reveal">
            <div className="text-center mb-10">
              <span className="eyebrow justify-center mb-5"><span className="dot" /> {t('landing.homage.eyebrow', 'quem foi a Dona Wilma')}</span>
              <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-primary leading-tight">
                {t('landing.homage.title', 'Por trás do nome, uma história de verdade')}
              </h2>
            </div>

            <div className="grid md:grid-cols-[minmax(0,320px)_1fr] gap-8 md:gap-12 items-center">
              {/* Retrato polaroid */}
              <div className="flex justify-center md:justify-start">
                <figure className="bg-[hsl(var(--creme))] border border-border rounded-2xl p-3 pb-6 shadow-soft rotate-[-2deg] max-w-[280px]">
                  <img
                    src={donaWilmaLandingHero}
                    alt={t('landing.homage.portraitAlt', 'Dona Wilma, a inspiração por trás do produto')}
                    className="w-full h-auto rounded-xl object-cover aspect-[4/5]"
                    loading="lazy"
                  />
                  <figcaption className="hand text-xl text-[hsl(var(--mel-deep))] text-center mt-3">
                    {t('landing.homage.portraitCaption', 'Dona Wilma')}
                  </figcaption>
                </figure>
              </div>

              {/* Card com o texto */}
              <div className="relative bg-[hsl(var(--creme))] border border-border rounded-3xl p-8 md:p-10 shadow-soft">
                <div className="absolute -top-3 left-8 hand text-2xl md:text-3xl text-[hsl(var(--mel-deep))] rotate-[-3deg]">
                  {t('landing.homage.handwritten', 'com carinho ❤')}
                </div>
                <p className="text-lg md:text-xl leading-relaxed text-foreground/85 whitespace-pre-line">
                  {t('landing.homage.body', 'Dona Wilma foi a minha mãe — a mulher que cuidava das contas da casa com um caderninho, não deixava faltar nada e ainda dava um jeito de guardar um pouquinho todo mês.\n\nEste produto é uma homenagem a ela e à forma como ela cuidava de todo mundo. Cada mensagem que a Dona Wilma responde no seu WhatsApp carrega um pedacinho desse cuidado.')}
                </p>
                <p className="hand text-2xl md:text-3xl text-[hsl(var(--mel-deep))] mt-8">
                  {t('landing.homage.signature', '— Alexandre, filho da Dona Wilma')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* Contato */}
      <section id="contato" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 scroll-reveal">
            <div className="section-line mx-auto mb-6" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
              {t('landing.contactSection.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t('landing.contactSection.subtitle')}
            </p>
          </div>
          <div className="max-w-2xl mx-auto scroll-reveal delay-1">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-dark mt-8">
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <a href="#home" className="inline-block mb-5">
                <BrandLogo className="h-8" invert />
              </a>
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
                <li><button onClick={() => navigate("/termos")} className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.footer.terms')}</button></li>
                <li><button onClick={() => navigate("/privacidade")} className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.footer.privacy')}</button></li>
              </ul>
            </div>
            <div>
              <h3 className="font-display font-semibold text-secondary mb-5">{t('landing.nav.contact')}</h3>
              <button
                onClick={() => scrollToSection('contato')}
                className="text-sm text-white/60 hover:text-white hover:translate-x-1 inline-block transition-all"
              >
                {t('landing.contactSection.footerLink')}
              </button>
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
      
      const alreadyRedirected = sessionStorage.getItem('redirected_to_welcome') === 'true';

      const { data: whatsappSession } = await supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!whatsappSession && !alreadyRedirected) {
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
