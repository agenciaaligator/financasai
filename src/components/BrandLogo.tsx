import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  invert?: boolean;
  alt?: string;
}

/**
 * Marca da Dona Wilma. Centraliza o asset do logo para trocar em um único lugar.
 * Use `invert` para aplicar `brightness-0 invert` sobre fundos escuros (pinho).
 */
export function BrandLogo({ className, invert = false, alt = "Dona Wilma" }: BrandLogoProps) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      className={cn(className, invert && "brightness-0 invert")}
    />
  );
}

export default BrandLogo;
