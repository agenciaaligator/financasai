import { Brain, Clock, Shield, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StatsSection() {
  const { t } = useTranslation();

  const icons = [
    <Smartphone className="h-7 w-7 text-primary" />,
    <Brain className="h-7 w-7 text-primary" />,
    <Clock className="h-7 w-7 text-primary" />,
    <Shield className="h-7 w-7 text-primary" />
  ];

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-14 scroll-reveal">
        <div className="section-line mx-auto mb-6" />
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
          {t('landing.stats.title')}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('landing.stats.subtitle')}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {icons.map((icon, index) => (
          <div 
            key={index} 
            className={`modern-card text-center p-6 scroll-reveal delay-${index + 1}`}
          >
            <div className="icon-circle mx-auto mb-4">
              {icon}
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">
              {t(`landing.stats.items.${index}.title`)}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`landing.stats.items.${index}.description`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
