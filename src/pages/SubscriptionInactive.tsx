import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, ExternalLink, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function SubscriptionInactive() {
  const [loading, setLoading] = useState(false);
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card shadow-primary border-0">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-destructive/10 rounded-full">
              <ShieldX className="h-10 w-10 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {t('subscription.inactiveTitle', 'Sua assinatura está inativa')}
          </CardTitle>
          <p className="text-muted-foreground">
            {t('subscription.inactiveDesc', 'Regularize sua assinatura para continuar usando o Dona Wilma.')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full bg-gradient-primary hover:shadow-primary"
            onClick={handleRegularize}
            disabled={loading}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {loading ? t('common.loading') : t('subscription.regularize', 'Regularizar assinatura')}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('auth.logout')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
