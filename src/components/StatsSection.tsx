import { Card, CardContent } from "@/components/ui/card";
import { Brain, Clock, Shield, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StatsSection() {
  const { t } = useTranslation();

  const icons = [
    <Smartphone className="h-8 w-8 text-primary" />,
    <Brain className="h-8 w-8 text-primary" />,
    <Clock className="h-8 w-8 text-primary" />,
    <Shield className="h-8 w-8 text-primary" />
  ];

  return (
    <section className="container mx-auto px-4 py-20 bg-muted/30">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          {t('landing.stats.title')}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('landing.stats.subtitle')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {icons.map((icon, index) => (
          <Card key={index} className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-6 space-y-3 flex flex-col items-center">
              {icon}
              <h3 className="text-lg font-semibold">{t(`landing.stats.items.${index}.title`)}</h3>
              <p className="text-sm text-muted-foreground">
                {t(`landing.stats.items.${index}.description`)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
