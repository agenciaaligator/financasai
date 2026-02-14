import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';

const languages = [
  { code: 'pt-BR', flag: '🇧🇷', short: 'BR', label: 'Português (BR)' },
  { code: 'pt-PT', flag: '🇵🇹', short: 'PT', label: 'Português (PT)' },
  { code: 'en-US', flag: '🇺🇸', short: 'EN', label: 'English' },
  { code: 'es-ES', flag: '🇪🇸', short: 'ES', label: 'Español' },
  { code: 'it-IT', flag: '🇮🇹', short: 'IT', label: 'Italiano' },
];

interface LanguageFlagSelectorProps {
  inline?: boolean;
  onSelect?: () => void;
}

export function LanguageFlagSelector({ inline, onSelect }: LanguageFlagSelectorProps = {}) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = languages.find((l) => l.code === i18n.language) || languages[0];

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
    setOpen(false);
    onSelect?.();
  };

  if (inline) {
    return (
      <div className="flex flex-col gap-1">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer
              ${lang.code === current.code
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-foreground'
              }`}
            type="button"
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium cursor-pointer"
          type="button"
        >
          <span className="text-base leading-none">{current.flag}</span>
          <span className="text-foreground">{current.short}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end" sideOffset={8}>
        <div className="flex flex-col">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer
                ${lang.code === current.code
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-muted text-foreground'
                }`}
              type="button"
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
