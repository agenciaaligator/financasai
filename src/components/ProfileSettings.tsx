import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Lock, Crown, Calendar, Check, X, ExternalLink, RefreshCw, Bug, Shield, MessageSquare, Phone, BarChart3, Link2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
import { UpgradeModal } from "./UpgradeModal";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { GoogleCalendarConnect } from "./dashboard/GoogleCalendarConnect";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { profileSchema } from "@/lib/validations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function ProfileSettings() {
  // Estados do perfil básico
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Estados do WhatsApp (migrados do WhatsAppSetup)
  const [authCode, setAuthCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasRecentWhatsAppActivity, setHasRecentWhatsAppActivity] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [linkingOrg, setLinkingOrg] = useState(false);
  const [linkedOrgName, setLinkedOrgName] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ last_activity?: string; expires_at?: string } | null>(null);
  const [commandsOpen, setCommandsOpen] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription, planName, isFreePlan, isTrial, isPremium, planLimits } = useSubscription();
  const { currentUsage, getTransactionProgress, getCategoryProgress } = useFeatureLimits();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const [managingSubscription, setManagingSubscription] = useState(false);
  const { syncNow, runDiagnostics, loading: gcLoading } = useGoogleCalendar();
  const { organization_id } = useOrganizationPermissions();

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";

  useEffect(() => {
    fetchProfile();
    if (planLimits?.hasWhatsapp) {
      checkAuthenticationStatus();
      fetchLinkedOrganization();
      
      // Setup real-time listener para WhatsApp sessions
      const channel = supabase
        .channel('whatsapp-session-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'whatsapp_sessions',
            filter: `user_id=eq.${user?.id}`
          },
          () => {
            checkAuthenticationStatus();
            fetchLinkedOrganization();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, planLimits]);

  // Poll status para WhatsApp
  useEffect(() => {
    if (!user || !planLimits?.hasWhatsapp) return;
    let active = true;
    let count = 0;
    let timer: any;

    const poll = async () => {
      if (!active) return;
      await checkAuthenticationStatus();
      await checkRecentWhatsAppActivity();
      count++;
      if (active && count < 12) {
        timer = setTimeout(poll, 5000);
      }
    };

    poll();
    return () => { 
      active = false; 
      if (timer) clearTimeout(timer); 
    };
  }, [user, planLimits]);

  useEffect(() => {
    if (planLimits?.hasWhatsapp) {
      fetchSessionInfo();
    }
  }, [isAuthenticated, hasRecentWhatsAppActivity, planLimits]);

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

  const fetchLinkedOrganization = async () => {
    if (!user) return;
    
    try {
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('organization_id')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (session?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', session.organization_id)
          .single();
        
        setLinkedOrgName(org?.name || null);
      } else {
        setLinkedOrgName(null);
      }
    } catch (error) {
      console.error('Error fetching linked organization:', error);
    }
  };

  const checkAuthenticationStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('is_whatsapp_authenticated_for_user', {
        p_user_id: user.id
      });
      
      if (error) {
        console.error('Erro RPC is_whatsapp_authenticated_for_user:', error);
        setIsAuthenticated(false);
        return;
      }
      
      setIsAuthenticated(data === true);
    } catch (error) {
      console.error('Erro ao verificar autenticação WhatsApp:', error);
      setIsAuthenticated(false);
    }
  };

  const checkRecentWhatsAppActivity = async () => {
    if (!user) return false;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('source', 'whatsapp')
        .gte('created_at', since)
        .limit(1);
      if (error) {
        console.error('Erro ao verificar atividade WhatsApp:', error);
        setHasRecentWhatsAppActivity(false);
        return false;
      }
      const has = Array.isArray(data) && data.length > 0;
      setHasRecentWhatsAppActivity(has);
      return has;
    } catch (e) {
      console.error('Erro ao verificar atividade WhatsApp:', e);
      setHasRecentWhatsAppActivity(false);
      return false;
    }
  };

  const fetchSessionInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', user.id)
      .single();

    if (!profile?.phone_number) return;

    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('last_activity, expires_at')
      .eq('phone_number', profile.phone_number)
      .maybeSingle();

    setSessionInfo(session);
  };

  const effectiveAuthenticated = isAuthenticated || 
    hasRecentWhatsAppActivity || 
    (sessionInfo?.expires_at && new Date(sessionInfo.expires_at) > new Date());
  
  const getStatusMessage = () => {
    if (!sessionInfo) return null;
    
    const now = new Date();
    const expiresAt = sessionInfo.expires_at ? new Date(sessionInfo.expires_at) : null;
    const lastActivity = sessionInfo.last_activity ? new Date(sessionInfo.last_activity) : null;
    
    if (expiresAt && expiresAt <= now) {
      return "Sessão expirada - Revalide";
    }
    
    if (expiresAt && expiresAt > now && lastActivity) {
      const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let activityMsg = "";
      if (daysSinceActivity === 0) activityMsg = "usado hoje";
      else if (daysSinceActivity === 1) activityMsg = "usado ontem";
      else if (daysSinceActivity <= 7) activityMsg = `usado há ${daysSinceActivity} dias`;
      else activityMsg = `último uso há ${daysSinceActivity} dias`;
      
      return `Sessão ativa (${activityMsg}, expira em ${daysUntilExpiry}d)`;
    }
    
    return null;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
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

  const handleRequestCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "Número necessário",
        description: "Por favor, digite seu número de WhatsApp para continuar",
        variant: "destructive"
      });
      return;
    }

    setWhatsappLoading(true);
    try {
      if (user) {
        await supabase
          .from('profiles')
          .update({ phone_number: phoneNumber.trim() })
          .eq('user_id', user.id);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          action: 'auth'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.response.includes('não encontrado') || result.response.includes('não está registrado')) {
          toast({
            title: "Número não cadastrado",
            description: "Atualize seu número no perfil e tente novamente",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Código enviado!",
            description: "Verifique o código gerado e insira abaixo para validar",
          });
        }
      } else {
        throw new Error(result.error || 'Falha ao enviar código');
      }

      await checkAuthenticationStatus();
      await checkRecentWhatsAppActivity();
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao solicitar código",
        variant: "destructive"
      });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode) {
      toast({
        title: "Código necessário",
        description: "Por favor, digite o código de 6 dígitos",
        variant: "destructive"
      });
      return;
    }

    setWhatsappLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          message: {
            body: `codigo ${authCode}`
          }
        })
      });

      const result = await response.json();
      
      if (result.success && result.response.includes('sucesso')) {
        setIsAuthenticated(true);
        toast({
          title: "✅ WhatsApp autenticado!",
          description: "Agora você pode gerenciar suas finanças pelo WhatsApp",
        });
        setAuthCode("");
        await checkAuthenticationStatus();
        await checkRecentWhatsAppActivity();
      } else {
        throw new Error('Código inválido');
      }
    } catch (error) {
      toast({
        title: "Código inválido",
        description: "Verifique o código e tente novamente",
        variant: "destructive"
      });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleLinkToCurrentOrg = async () => {
    if (!organization_id) {
      toast({
        title: "Erro",
        description: "Você não pertence a nenhuma organização",
        variant: "destructive"
      });
      return;
    }

    setLinkingOrg(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-session-set-org', {
        body: { organization_id }
      });

      if (error) throw error;

      toast({
        title: "✅ WhatsApp vinculado!",
        description: data.message || "WhatsApp vinculado à organização atual com sucesso",
      });
      
      await fetchLinkedOrganization();
      window.dispatchEvent(new Event('force-transactions-refetch'));

    } catch (error) {
      console.error('Error linking WhatsApp to organization:', error);
      toast({
        title: "Erro ao vincular",
        description: error instanceof Error ? error.message : "Não foi possível vincular o WhatsApp à organização",
        variant: "destructive"
      });
    } finally {
      setLinkingOrg(false);
    }
  };

  const handleCheckStatus = async () => {
    setStatusLoading(true);
    try {
      await checkAuthenticationStatus();
      await checkRecentWhatsAppActivity();
      await fetchSessionInfo();
      
      const effective = isAuthenticated || hasRecentWhatsAppActivity || (sessionInfo?.expires_at && new Date(sessionInfo.expires_at) > new Date());
      
      toast({
        title: effective ? "✅ Conectado" : "❌ Não conectado",
        description: effective 
          ? `WhatsApp autenticado${getStatusMessage() ? ' - ' + getStatusMessage() : ''}` 
          : "WhatsApp não está autenticado. Solicite um novo código.",
      });
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível verificar o status",
        variant: "destructive"
      });
    } finally {
      setStatusLoading(false);
    }
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
      {/* Card 1: Informações do Perfil */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Informações do Perfil</span>
          </CardTitle>
          <CardDescription>
            Gerencie suas informações pessoais e dados de contato
          </CardDescription>
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
              <Label htmlFor="phoneNumber">Número WhatsApp</Label>
              <Input
                id="phoneNumber"
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="5511999999999"
              />
              <p className="text-xs text-muted-foreground">
                Formato internacional sem o + (ex: 5511999999999)
              </p>
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

      {/* Card 2: Alterar Senha */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>Alterar Senha</span>
          </CardTitle>
          <CardDescription>
            Atualize sua senha de acesso
          </CardDescription>
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

      {/* Card 3: Configuração WhatsApp */}
      {planLimits?.hasWhatsapp && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Configuração WhatsApp
            </CardTitle>
            <CardDescription>
              Configure seu WhatsApp para gerenciar finanças por mensagem. 
              Receba lembretes, crie transações e consulte saldos diretamente no app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={effectiveAuthenticated ? "default" : "secondary"}>
                  {effectiveAuthenticated ? "Autenticado" : "Não autenticado"}
                </Badge>
                {effectiveAuthenticated && getStatusMessage() && (
                  <span className="text-xs text-muted-foreground">
                    {getStatusMessage()}
                  </span>
                )}
              </div>
              
              {effectiveAuthenticated && linkedOrgName && (
                <div className="text-xs text-muted-foreground">
                  📍 Vinculado a: <strong>{linkedOrgName}</strong>
                </div>
              )}
              
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckStatus}
                  disabled={statusLoading}
                >
                  {statusLoading ? "Verificando..." : "Verificar status"}
                </Button>
                
                {effectiveAuthenticated && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setIsAuthenticated(false);
                        setCodeSent(false);
                        setAuthCode("");
                        await handleRequestCode();
                      }}
                    >
                      Revalidar WhatsApp
                    </Button>
                    
                    {organization_id && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleLinkToCurrentOrg}
                        disabled={linkingOrg}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        {linkingOrg ? "Vinculando..." : "Vincular à org atual"}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Autenticação */}
            {!isAuthenticated && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsappPhone">Número do WhatsApp</Label>
                  <Input
                    id="whatsappPhone"
                    placeholder="5511999999999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use o formato internacional (sem +): exemplo 5511999999999
                  </p>
                </div>

                <Button 
                  onClick={handleRequestCode} 
                  disabled={whatsappLoading || !phoneNumber}
                  className="w-full"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {whatsappLoading ? "Enviando..." : "Solicitar Código"}
                </Button>

                {phoneNumber && (
                  <div className="space-y-2">
                    <Label htmlFor="code">Código de Verificação</Label>
                    <Input
                      id="code"
                      placeholder="Digite o código de 6 dígitos"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      maxLength={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Insira o código gerado acima na plataforma
                    </p>
                    <Button 
                      onClick={handleVerifyCode} 
                      disabled={whatsappLoading || !authCode}
                      variant="outline"
                      className="w-full"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      {whatsappLoading ? "Verificando..." : "Validar Código"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Orientações */}
            {phoneNumber && (
              <div className="pt-4 border-t">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">💡 Orientações de Uso</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    <li>Certifique-se de que o número informado está correto</li>
                    <li>O código de verificação é válido por alguns minutos</li>
                    <li>Após autenticar, você pode começar a usar os comandos</li>
                    <li>Para testar lembretes, acesse a aba <strong>Agenda</strong></li>
                  </ul>
                </div>
              </div>
            )}

            {/* Comandos disponíveis - Collapsible */}
            <Collapsible open={commandsOpen} onOpenChange={setCommandsOpen} className="border-t pt-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium hover:underline">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Comandos Disponíveis
                </span>
                <span className="text-xs text-muted-foreground">
                  {commandsOpen ? "Ocultar" : "Ver comandos"}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid gap-4">
                  <div>
                    <h4 className="font-medium mb-2 text-sm">📝 Adicionar Transações</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• "gasto 50 mercado"</li>
                      <li>• "receita 1000 salario"</li>
                      <li>• "+100 freelance"</li>
                      <li>• "-30 combustível"</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2 text-sm">📊 Consultas</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• "saldo" - Ver saldo atual</li>
                      <li>• "relatorio" - Resumo mensal</li>
                      <li>• "ajuda" - Lista de comandos</li>
                    </ul>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Card 4: Google Calendar */}
      {planLimits?.hasGoogleCalendar && (
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Google Calendar</span>
            </CardTitle>
            <CardDescription>
              Sincronize automaticamente compromissos criados pelo WhatsApp com seu calendário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

      {/* Card 5: Minha Assinatura */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-primary" />
            <span>Minha Assinatura</span>
          </CardTitle>
          <CardDescription>
            Gerencie seu plano e veja os recursos disponíveis
          </CardDescription>
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

      <UpgradeModal 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
