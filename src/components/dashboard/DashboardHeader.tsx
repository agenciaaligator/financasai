import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTranslation } from "react-i18next";

interface DashboardHeaderProps {
  userEmail?: string;
  onSignOut: () => void;
  minimal?: boolean;
}

export function DashboardHeader({ userEmail, onSignOut, minimal = false }: DashboardHeaderProps) {
  const { t } = useTranslation();

  if (minimal) {
    return (
      <div className="flex items-center gap-3">
        <LanguageSelector />
        <Button 
          onClick={onSignOut}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          {t('auth.logout', 'Sair')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          {t('dashboard.title', 'Dashboard Financeiro')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('dashboard.subtitle', 'Gerencie suas finanças de forma inteligente')}
        </p>
      </div>
      
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {userEmail}
          </span>
        </div>
        
        <LanguageSelector />
        
        <Button 
          onClick={onSignOut}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          {t('auth.logout', 'Sair')}
        </Button>
      </div>
    </div>
  );
}
