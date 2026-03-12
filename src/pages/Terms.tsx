import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

const sectionKeys = [
  "acceptance", "description", "account", "payment", "acceptableUse",
  "ip", "liability", "modifications", "contact"
] as const;

export default function Terms() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
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
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('legal.backButton')}
          </Button>
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
        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/images/logo.png" alt="Dona Wilma" className="h-6 brightness-0 invert" />
              <span className="text-sm text-white/50">{t('landing.footer.tagline')}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/50">
              <button onClick={() => navigate("/termos")} className="hover:text-white transition-colors">{t('landing.footer.terms')}</button>
              <button onClick={() => navigate("/privacidade")} className="hover:text-white transition-colors">{t('landing.footer.privacy')}</button>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-center text-sm text-white/40 space-y-1">
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
