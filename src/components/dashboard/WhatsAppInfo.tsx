import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WhatsAppInfo() {
  const { t } = useTranslation();

  return (
    <Card className="mt-6 bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle>{t('whatsapp.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          {t('whatsapp.afterConnect')}
        </p>
        
        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">📝 {t('whatsapp.addTransactions')}:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• {t('whatsapp.cmdAddExpense')}</li>
              <li>• {t('whatsapp.cmdAddIncome')}</li>
              <li>• {t('whatsapp.cmdAddPlus')}</li>
              <li>• {t('whatsapp.cmdAddMinus')}</li>
            </ul>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">📸 {t('whatsapp.ocr')}:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• {t('whatsapp.cmdOcrStep1')}</li>
              <li>• {t('whatsapp.cmdOcrStep2')}</li>
              <li>• {t('whatsapp.cmdOcrStep3')}</li>
            </ul>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">✏️ {t('whatsapp.editDelete')}:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• {t('whatsapp.cmdEditLast')}</li>
              <li>• {t('whatsapp.cmdDeleteLast')}</li>
            </ul>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <p className="text-sm font-semibold">📊 {t('whatsapp.queries')}:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• {t('whatsapp.cmdBalance')}</li>
              <li>• {t('whatsapp.cmdToday')}</li>
              <li>• {t('whatsapp.cmdWeek')}</li>
              <li>• {t('whatsapp.cmdMonth')}</li>
            </ul>
          </div>

          <div className="bg-primary/10 p-3 rounded-lg">
            <p className="text-sm font-medium">💡 {t('whatsapp.sendHelpHint')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
