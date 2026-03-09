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
    <div className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center py-8 ${
      imagePosition === 'right' ? '' : ''
    }`}>
      {/* Content */}
      <div className={`space-y-6 ${imagePosition === 'right' ? 'md:order-1' : 'md:order-2'}`}>
        <div className="flex items-center gap-3">
          <div className="icon-circle">
            {icon}
          </div>
          <span className="text-xs font-bold tracking-wider text-primary uppercase font-display">
            {title}
          </span>
        </div>
        
        <h3 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
          {subtitle}
        </h3>
        
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
        
        <ul className="space-y-3 pt-2">
          {highlights.map((highlight, index) => (
            <li key={index} className="flex items-start gap-3 group">
              <div className="p-1 bg-primary/10 rounded-full mt-0.5 group-hover:bg-primary/20 transition-colors">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <span className="text-base text-foreground/80">{highlight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Image */}
      <div className={`${imagePosition === 'right' ? 'md:order-2' : 'md:order-1'}`}>
        <div className="feature-card hover-lift overflow-hidden">
          <img 
            src={imageSrc} 
            alt={imageAlt}
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
