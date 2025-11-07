import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Lock, Crown, Calendar, Check, X, ExternalLink, RefreshCw, Bug, Shield } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
import { UpgradeModal } from "./UpgradeModal";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { GoogleCalendarConnect } from "./dashboard/GoogleCalendarConnect";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { profileSchema } from "@/lib/validations";

export function ProfileSettings() {
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription, planName, isFreePlan, isTrial, isPremium, planLimits } = useSubscription();
  const { currentUsage, getTransactionProgress, getCategoryProgress } = useFeatureLimits();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const [managingSubscription, setManagingSubscription] = useState(false);
  const { syncNow, runDiagnostics, loading: gcLoading } = useGoogleCalendar();
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);

  useEffect(() => {
    fetchProfile();
    checkWhatsAppConnection();
  }, [user]);
  
  const checkWhatsAppConnection = async () => {
    if (!user) return;
    
    const { data } = await supabase.rpc('is_whatsapp_authenticated_for_user', {
      p_user_id: user.id
    });
    
    setIsWhatsAppConnected(data === true);
  };

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone_number')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setFullName(data.full_name || "");
      setPhoneNumber(data.phone_number || "");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      // Validar dados
      const validated = profileSchema.parse({
        full_name: fullName,
        phone_number: phoneNumber || ''
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: validated.full_name,
          phone_number: validated.phone_number || null
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso."
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message || "Erro de validação",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Senha alterada!",
        description: "Sua senha foi atualizada com sucesso."
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setLoading(false);
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Portal aberto!",
          description: "Gerencie sua assinatura na nova aba",
        });
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Erro ao abrir portal",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setManagingSubscription(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Informações do Perfil</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Digite seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">WhatsApp</Label>
              <Input
                id="phoneNumber"
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="5511999999999"
                disabled={isWhatsAppConnected}
              />
              {isWhatsAppConnected ? (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <span>Número bloqueado enquanto WhatsApp estiver conectado. Desconecte primeiro para alterar.</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Formato internacional sem o + (ex: 5511999999999)
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-primary hover:shadow-primary"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>Alterar Senha</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
                required
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading || !newPassword || !confirmPassword}
              className="bg-gradient-primary hover:shadow-primary"
            >
              {loading ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-primary" />
            <span>Minha Assinatura</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{planName}</h3>
                {subscription && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                  </p>
                )}
              </div>
              <Badge variant={isPremium ? "default" : isTrial ? "secondary" : "outline"}>
                {isPremium ? 'Premium' : isTrial ? 'Trial' : 'Gratuito'}
              </Badge>
            </div>

            {subscription?.current_period_end && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Calendar className="h-4 w-4" />
                <span>
                  Renova em: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Uso do Plano</h4>
            
            {getTransactionProgress() && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Transações</span>
                  <span className="font-medium">
                    {currentUsage.transactions}/{getTransactionProgress()?.limit || '∞'}
                  </span>
                </div>
                <Progress value={getTransactionProgress()?.percentage || 0} className="h-2" />
              </div>
            )}

            {getCategoryProgress() && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Categorias</span>
                  <span className="font-medium">
                    {currentUsage.categories}/{getCategoryProgress()?.limit || '∞'}
                  </span>
                </div>
                <Progress value={getCategoryProgress()?.percentage || 0} className="h-2" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm">Recursos Disponíveis</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasWhatsapp ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasAiReports ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>IA Reports</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasGoogleCalendar ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Google Calendar</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasBankIntegration ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Integração Bancária</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasMultiUser ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Multi-usuário</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {planLimits?.hasPrioritySupport ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Suporte Prioritário</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(isFreePlan || isTrial) && (
              <Button 
                className="w-full bg-gradient-primary hover:shadow-primary"
                onClick={() => setShowUpgradeModal(true)}
              >
                <Crown className="h-4 w-4 mr-2" />
                Fazer Upgrade para Premium
              </Button>
            )}

            {isPremium && subscriptionStatus?.stripe_customer_id && (
              <Button 
                className="w-full"
                variant="outline"
                onClick={handleManageSubscription}
                disabled={managingSubscription}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {managingSubscription ? 'Abrindo...' : 'Gerenciar Assinatura'}
              </Button>
            )}

            {subscriptionStatus?.stripe_subscription_id && (
              <p className="text-xs text-muted-foreground text-center">
                ID da Assinatura: {subscriptionStatus.stripe_subscription_id}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {planLimits?.hasGoogleCalendar && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Google Calendar</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              💡 Conecte sua conta Google para sincronizar automaticamente compromissos criados pelo WhatsApp com seu calendário.
            </p>
            <GoogleCalendarConnect />
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={syncNow} 
                disabled={gcLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${gcLoading ? 'animate-spin' : ''}`} />
                Sincronizar Agora
              </Button>
              <Button 
                onClick={runDiagnostics} 
                disabled={gcLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Bug className="h-4 w-4" />
                Diagnóstico
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <UpgradeModal 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}