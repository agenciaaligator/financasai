import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { MessageSquare, Phone, LogOut } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function WhatsAppPage() {
  const { t } = useTranslation();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkedOrgName, setLinkedOrgName] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ last_activity?: string; expires_at?: string } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { organization_id } = useOrganizationPermissions();

  const supabaseUrl = "https://fsamlnlabdjoqpiuhgex.supabase.co";

  const fetchLinkedOrganization = async () => {
    if (!user) return;
    try {
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('organization_id')
        .eq('user_id', user.id)
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

  const fetchSessionInfo = async () => {
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

  const fetchPhoneNumber = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data?.phone_number) {
      setPhoneNumber(data.phone_number);
    }
  };

  useEffect(() => {
    fetchPhoneNumber();
    checkAuthenticationStatus();
    fetchLinkedOrganization();
    fetchSessionInfo();
    const channel = supabase
      .channel('whatsapp-session-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_sessions', filter: `user_id=eq.${user?.id}` }, () => {
        checkAuthenticationStatus();
        fetchLinkedOrganization();
        fetchSessionInfo();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleConnect = async () => {
    if (!phoneNumber) {
      toast({
        title: t('whatsapp.numberRequired'),
        description: t('whatsapp.numberRequiredDesc'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      if (user) {
        await supabase.from('profiles').update({ phone_number: phoneNumber.trim() }).eq('user_id', user.id);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, action: 'auth' })
      });

      const result = await response.json();
      
      if (result.success) {
        if (result.response.includes('não encontrado') || result.response.includes('não está registrado')) {
          toast({
            title: t('whatsapp.numberNotRegistered'),
            description: t('whatsapp.numberNotRegisteredDesc'),
            variant: "destructive"
          });
        } else {
          toast({
            title: t('whatsapp.codeSent'),
            description: t('whatsapp.codeSentDesc'),
          });
        }
      } else {
        throw new Error(result.error || 'Failed');
      }

      await checkAuthenticationStatus();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.genericError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!authCode) {
      toast({
        title: t('whatsapp.codeRequired'),
        description: t('whatsapp.codeRequiredDesc'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, message: { body: `codigo ${authCode}` } })
      });

      const result = await response.json();
      
      if (result.success && result.response.includes('sucesso')) {
        setIsAuthenticated(true);
        if (organization_id) {
          await supabase.functions.invoke('whatsapp-session-set-org', { body: { organization_id } });
        }
        toast({
          title: t('whatsapp.connectedSuccess'),
          description: t('whatsapp.connectedSuccessDesc'),
        });
        setAuthCode("");
        await checkAuthenticationStatus();
        await fetchLinkedOrganization();
        await fetchSessionInfo();
      } else {
        throw new Error('Invalid code');
      }
    } catch (error) {
      toast({
        title: t('whatsapp.invalidCode'),
        description: t('whatsapp.invalidCodeDesc'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase.from('whatsapp_sessions').delete().eq('user_id', user.id);
      await supabase.from('profiles').update({ phone_number: null }).eq('user_id', user.id);
      setIsAuthenticated(false);
      setLinkedOrgName(null);
      setSessionInfo(null);
      setPhoneNumber('');
      toast({
        title: t('whatsapp.disconnected'),
        description: t('whatsapp.disconnectedDesc'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('whatsapp.cannotDisconnect'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getLastActivityMessage = () => {
    if (!sessionInfo?.last_activity) return null;
    const now = new Date();
    const lastActivity = new Date(sessionInfo.last_activity);
    const hoursSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60));
    
    if (hoursSinceActivity < 1) return t('whatsapp.lessThan1Hour');
    if (hoursSinceActivity === 1) return t('whatsapp.oneHourAgo');
    if (hoursSinceActivity < 24) return t('whatsapp.hoursAgo', { count: hoursSinceActivity });
    
    const daysSinceActivity = Math.floor(hoursSinceActivity / 24);
    if (daysSinceActivity === 1) return t('whatsapp.oneDayAgo');
    return t('whatsapp.daysAgo', { count: daysSinceActivity });
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{t('whatsapp.title')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('whatsapp.setupIn2Min')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium">✨ {t('whatsapp.afterConnect')}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• {t('whatsapp.addByVoice')}</li>
                <li>• {t('whatsapp.sendReceipts')}</li>
                <li>• {t('whatsapp.checkBalance')}</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">
                  <Phone className="inline h-4 w-4 mr-1" />
                  {t('whatsapp.phoneLabel')}
                </Label>
                <Input
                  id="phone"
                  placeholder={t('whatsapp.phonePlaceholder')}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('whatsapp.phoneFormat')}
                </p>
              </div>

              {phoneNumber && (
                <div className="space-y-2">
                  <Label htmlFor="code">{t('whatsapp.codeLabel')}</Label>
                  <Input
                    id="code"
                    placeholder={t('whatsapp.codePlaceholder')}
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    maxLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('whatsapp.codeHint')}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={loading || !phoneNumber}
                  className="flex-1"
                >
                  {loading ? t('whatsapp.sending') : t('whatsapp.connect')}
                </Button>
                {authCode && (
                  <Button
                    onClick={handleVerifyCode}
                    disabled={loading || authCode.length !== 6}
                    variant="default"
                  >
                    {t('whatsapp.verifyCode')}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">WhatsApp</CardTitle>
                <Badge variant="default" className="mt-1 bg-green-600">
                  ✓ {t('whatsapp.connected')}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">📱 {t('whatsapp.number')}</p>
              <p className="font-mono text-sm">+{phoneNumber}</p>
            </div>
            
            {linkedOrgName && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">📂 {t('whatsapp.linkedTo')}</p>
                <p className="font-semibold text-sm">{linkedOrgName}</p>
              </div>
            )}
            
            {sessionInfo?.last_activity && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">🕐 {t('whatsapp.lastActivity')}</p>
                <p className="text-sm">{getLastActivityMessage()}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t('whatsapp.disconnect')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader>
          <CardTitle>📖 {t('whatsapp.quickGuide')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('whatsapp.sendHelpHint')}
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="add">
            <AccordionItem value="add">
              <AccordionTrigger>📝 {t('whatsapp.addTransactions')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t('whatsapp.cmdAddExpense')}</li>
                  <li>• {t('whatsapp.cmdAddIncome')}</li>
                  <li>• {t('whatsapp.cmdAddPlus')}</li>
                  <li>• {t('whatsapp.cmdAddMinus')}</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ocr">
              <AccordionTrigger>📸 {t('whatsapp.ocr')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t('whatsapp.cmdOcrStep1')}</li>
                  <li>• {t('whatsapp.cmdOcrStep2')}</li>
                  <li>• {t('whatsapp.cmdOcrStep3')}</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="edit">
              <AccordionTrigger>✏️ {t('whatsapp.editDelete')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t('whatsapp.cmdEditLast')}</li>
                  <li>• {t('whatsapp.cmdDeleteLast')}</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="queries">
              <AccordionTrigger>📊 {t('whatsapp.queries')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {t('whatsapp.cmdBalance')}</li>
                  <li>• {t('whatsapp.cmdToday')}</li>
                  <li>• {t('whatsapp.cmdWeek')}</li>
                  <li>• {t('whatsapp.cmdMonth')}</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
