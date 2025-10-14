import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Check, Smartphone, Bell } from "lucide-react";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useTranslation } from "react-i18next";

interface GoogleCalendarOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GoogleCalendarOnboarding = ({ open, onOpenChange }: GoogleCalendarOnboardingProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const { connect } = useGoogleCalendar();
  const { t } = useTranslation();

  const handleConnect = () => {
    if (dontShowAgain) {
      localStorage.setItem('googleCalendarOnboardingSeen', 'true');
    }
    connect();
    onOpenChange(false);
  };

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('googleCalendarOnboardingSeen', 'true');
    }
    onOpenChange(false);
  };

  const benefits = [
    {
      icon: <Smartphone className="h-5 w-5 text-blue-600" />,
      title: t('agenda.onboarding.benefit1Title') || "Acesse de qualquer lugar",
      description: t('agenda.onboarding.benefit1Desc') || "Veja seus compromissos no celular, tablet ou computador",
    },
    {
      icon: <Bell className="h-5 w-5 text-green-600" />,
      title: t('agenda.onboarding.benefit2Title') || "Lembretes automáticos",
      description: t('agenda.onboarding.benefit2Desc') || "Receba notificações antes dos seus compromissos",
    },
    {
      icon: <Check className="h-5 w-5 text-purple-600" />,
      title: t('agenda.onboarding.benefit3Title') || "Sincronização em tempo real",
      description: t('agenda.onboarding.benefit3Desc') || "Alterações aparecem instantaneamente em todos os dispositivos",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
              <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-2xl">
              {t('agenda.onboarding.title') || 'Sincronize com Google Calendar'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {t('agenda.onboarding.description') || 'Mantenha seus compromissos sempre atualizados e acessíveis em todos os seus dispositivos.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex gap-3">
              <div className="mt-0.5">{benefit.icon}</div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">{benefit.title}</h4>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <span className="text-lg">🔒</span>
            {t('agenda.onboarding.securityTitle') || 'Seguro e Privado'}
          </h4>
          <p className="text-sm text-muted-foreground">
            {t('agenda.onboarding.securityDesc') || 'Suas informações são criptografadas e você pode desconectar a qualquer momento.'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="dontShowAgain"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
          />
          <label
            htmlFor="dontShowAgain"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {t('agenda.onboarding.dontShowAgain') || 'Não mostrar novamente'}
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel') || 'Agora não'}
          </Button>
          <Button onClick={handleConnect} className="gap-2">
            <Calendar className="h-4 w-4" />
            {t('agenda.connectGoogleCalendar') || 'Conectar Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
