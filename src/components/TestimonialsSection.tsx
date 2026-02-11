import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, DollarSign, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TestimonialsSection() {
  const { t } = useTranslation();

  const icons = [
    <MessageSquare className="h-10 w-10 text-primary" />,
    <DollarSign className="h-10 w-10 text-primary" />,
    <Calendar className="h-10 w-10 text-primary" />
  ];

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      {icons.map((icon, index) => (
        <Card key={index} className="text-center hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary/20">
          <CardContent className="p-8 space-y-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              {index + 1}
            </div>
            <h3 className="text-lg font-semibold">{t(`landing.steps.items.${index}.title`)}</h3>
            <p className="text-sm text-muted-foreground">
              {t(`landing.steps.items.${index}.description`)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
