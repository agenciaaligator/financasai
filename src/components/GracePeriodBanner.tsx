import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GracePeriodBannerProps {
  gracePeriodEndsAt: Date | null;
}

export function GracePeriodBanner({ gracePeriodEndsAt }: GracePeriodBannerProps) {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleRegularize = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch {
      toast({ title: t('common.error'), description: t('common.genericError'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const endsAt = gracePeriodEndsAt ? format(gracePeriodEndsAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <div>
          <p className="font-medium text-yellow-800 dark:text-yellow-200">
            {t('subscription.gracePeriodTitle', 'Sua assinatura está em atraso')}
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            {t('subscription.gracePeriodDesc', 'Regularize até {{date}} para evitar o bloqueio do acesso.', { date: endsAt })}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:bg-yellow-900/40 shrink-0"
        onClick={handleRegularize}
        disabled={loading}
      >
        <ExternalLink className="h-3 w-3 mr-2" />
        {loading ? t('common.loading') : t('subscription.regularize', 'Regularizar agora')}
      </Button>
    </div>
  );
}
