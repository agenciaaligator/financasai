import { Button } from "@/components/ui/button";
import { ChevronRight, FileText, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { LanguageFlagSelector } from "@/components/LanguageFlagSelector";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LoginForm } from "@/components/auth/LoginForm";

const sectionKeys = [
  "acceptance", "description", "account", "payment", "acceptableUse",
  "ip", "liability", "modifications", "contact"
] as const;

export default function Terms() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string>("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.4, rootMargin: "-80px 0px -60% 0px" }
    );
    sectionKeys.forEach((key) => {
      const el = document.getElementById(`section-${key}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-2">
              <img src="/images/logo.png" alt="Dona Wilma" className="h-8" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <ChevronRight className="h-4 w-4" />
              <span className="font-medium text-foreground">{t('legal.terms.title')}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate("/")} className="text-sm font-medium text-foreground/80 hover:text-primary transition-all duration-200 hover:-translate-y-0.5">Home</button>
            <button onClick={() => navigate("/termos")} className="text-sm font-medium text-primary transition-all duration-200">{t('landing.footer.terms')}</button>
            <button onClick={() => navigate("/privacidade")} className="text-sm font-medium text-foreground/80 hover:text-primary transition-all duration-200 hover:-translate-y-0.5">{t('landing.footer.privacy')}</button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <LanguageFlagSelector />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="font-medium hover:-translate-y-0.5 transition-transform gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('legal.backButton')}
            </Button>

            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <nav className="flex flex-col gap-4 mt-8">
                  <button onClick={() => { setSheetOpen(false); navigate("/"); }} className="text-lg font-medium hover:text-primary transition-colors text-left">Home</button>
                  <button onClick={() => { setSheetOpen(false); navigate("/termos"); }} className="text-lg font-medium text-primary text-left">{t('landing.footer.terms')}</button>
                  <button onClick={() => { setSheetOpen(false); navigate("/privacidade"); }} className="text-lg font-medium hover:text-primary transition-colors text-left">{t('landing.footer.privacy')}</button>
                  <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-border">
                    <LanguageFlagSelector inline onSelect={() => setSheetOpen(false)} />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      {/* Hero banner */}
      <div className="bg-primary/5 border-b">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center gap-4 max-w-3xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('legal.terms.title')}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t('legal.terms.lastUpdated')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto flex gap-10">
          {/* Sidebar index - desktop */}
          <aside className="hidden lg:block w-56 shrink-0">
            <nav className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('landing.footer.links')}</p>
              {sectionKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                    activeSection === `section-${key}`
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {t(`legal.terms.sections.${key}.title`)}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="bg-card rounded-2xl border shadow-sm p-6 md:p-10 space-y-8">
              {sectionKeys.map((key) => (
                <section key={key} id={`section-${key}`} className="scroll-mt-24">
                  <h2 className="text-lg font-semibold mb-3">{t(`legal.terms.sections.${key}.title`)}</h2>
                  <p className="text-muted-foreground leading-relaxed">{t(`legal.terms.sections.${key}.content`)}</p>
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer-dark mt-8">
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
                <li><button onClick={() => navigate("/")} className="hover:text-white hover:translate-x-1 inline-block transition-all">Home</button></li>
                <li><button onClick={() => navigate("/termos")} className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.footer.terms')}</button></li>
                <li><button onClick={() => navigate("/privacidade")} className="hover:text-white hover:translate-x-1 inline-block transition-all">{t('landing.footer.privacy')}</button></li>
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
              <a href="https://aligator.com.br" target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-secondary/80 font-semibold transition-colors">Aligator</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
