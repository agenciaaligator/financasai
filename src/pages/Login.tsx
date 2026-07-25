import { LoginForm } from "@/components/auth/LoginForm";
import { BrandLogo } from "@/components/BrandLogo";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="animated-bg" />
      <div className="w-full max-w-md space-y-6 relative">
        <div className="text-center space-y-3">
          <BrandLogo className="h-12 mx-auto" />
          <p className="hand text-2xl">{t('auth.welcomeBack', 'bem-vindo de volta, meu bem')}</p>
          <p className="text-muted-foreground text-sm">{t('auth.tagline', 'Sua assessora pessoal de finanças e compromissos')}</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
