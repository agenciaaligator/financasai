import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'pt-BR', label: '🇧🇷 Português (BR)', flag: '🇧🇷' },
    { code: 'pt-PT', label: '🇵🇹 Português (PT)', flag: '🇵🇹' },
    { code: 'en-US', label: '🇺🇸 English', flag: '🇺🇸' },
    { code: 'es-ES', label: '🇪🇸 Español', flag: '🇪🇸' },
    { code: 'it-IT', label: '🇮🇹 Italiano', flag: '🇮🇹' },
  ];

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('i18nextLng', value);
  };

  return (
    <Select value={i18n.language} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
