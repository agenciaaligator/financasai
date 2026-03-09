import { MessageSquare, DollarSign, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TestimonialsSection() {
  const { t } = useTranslation();

  const icons = [
    <MessageSquare className="h-6 w-6 text-primary" />,
    <DollarSign className="h-6 w-6 text-primary" />,
    <Calendar className="h-6 w-6 text-primary" />
  ];

  return (
    <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
      {icons.map((icon, index) => (
        <div 
          key={index} 
          className="modern-card text-center p-8 flex flex-col items-center"
        >
          {/* Step number */}
          <div className="step-number mb-6">
            {index + 1}
          </div>
          
          {/* Icon */}
          <div className="icon-circle mb-5">
            {icon}
          </div>
          
          {/* Content */}
          <h3 className="font-display text-lg font-semibold mb-3">
            {t(`landing.steps.items.${index}.title`)}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t(`landing.steps.items.${index}.description`)}
          </p>
        </div>
      ))}
    </div>
  );
}
