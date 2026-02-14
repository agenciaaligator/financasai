import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const sectionKeys = [
  "dataCollected", "dataUsage", "sharing", "ai", "security",
  "rights", "cookies", "retention", "dpo"
] as const;

export default function Privacy() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Dona Wilma</span>
          </button>
          <Button variant="outline" onClick={() => navigate("/")}>{t('legal.backButton')}</Button>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">{t('legal.privacy.title')}</h1>
        <p className="text-sm text-muted-foreground mb-6">{t('legal.privacy.lastUpdated')}</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          {sectionKeys.map((key) => (
            <section key={key}>
              <h2 className="text-xl font-semibold mb-3">{t(`legal.privacy.sections.${key}.title`)}</h2>
              <p className="text-muted-foreground">{t(`legal.privacy.sections.${key}.content`)}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
