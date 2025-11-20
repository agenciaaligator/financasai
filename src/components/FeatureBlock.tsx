import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

interface FeatureBlockProps {
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  imageSrc: string;
  imageAlt: string;
  imagePosition: 'left' | 'right';
  icon: React.ReactNode;
}

export function FeatureBlock({
  title,
  subtitle,
  description,
  highlights,
  imageSrc,
  imageAlt,
  imagePosition,
  icon
}: FeatureBlockProps) {
  return (
    <div className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center mb-20 ${
      imagePosition === 'right' ? 'md:flex-row-reverse' : ''
    }`}>
      {/* Conteúdo */}
      <div className={`space-y-6 ${imagePosition === 'right' ? 'md:order-2' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
          <span className="text-xs font-bold tracking-wider text-primary uppercase">
            {title}
          </span>
        </div>
        
        <h3 className="text-3xl md:text-4xl font-bold">
          {subtitle}
        </h3>
        
        <p className="text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
        
        <ul className="space-y-3">
          {highlights.map((highlight, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <span className="text-base">{highlight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Imagem */}
      <div className={`${imagePosition === 'right' ? 'md:order-1' : ''}`}>
        <Card className="overflow-hidden border-2 shadow-xl hover:shadow-2xl transition-shadow">
          <CardContent className="p-0">
            <img 
              src={imageSrc} 
              alt={imageAlt}
              className="w-full h-auto object-cover"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
