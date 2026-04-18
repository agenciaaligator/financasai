import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, MessageCircle, Loader2, ArrowRight, CheckCircle2, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { useTranslation } from "react-i18next";
import { LanguageFlagSelector } from "@/components/LanguageFlagSelector";

type ConnectionStep = 'loading' | 'waiting' | 'connected' | 'expired';

export default function Welcome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const guard = useSubscriptionGuard();
  const { t } = useTranslation();

  const [step, setStep] = useState<ConnectionStep>('loading');
  const [claimCode, setClaimCode] = useState('');
  const [donaWilmaNumber, setDonaWilmaNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [userName, setUserName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<number | null>(null);

  // Buscar perfil + verificar sessão existente
  useEffect(() => {
    if (loading || guard.loading) return;
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    // Bloquear acesso se não tem assinatura ativa (e não é master/admin)
    if (!guard.isMasterOrAdmin && guard.subscriptionStatus !== 'active' && !guard.isInGracePeriod) {
      console.log('[Welcome] No active subscription, redirecting to /escolher-plano');
      navigate('/escolher-plano', { replace: true });
      return;
    }

    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.full_name) setUserName(profile.full_name);

      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (session) {
        setPhoneNumber(session.phone_number);
        setStep('connected');
        return;
      }

      await generateClaimCode();
    })();
  }, [user, loading, guard.loading, guard.subscriptionStatus, guard.isMasterOrAdmin, guard.isInGracePeriod]);

  const generateClaimCode = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-claim-code');
      if (error) throw error;

      if (data?.already_connected) {
        setPhoneNumber(data.phone_number);
        setStep('connected');
        return;
      }

      setClaimCode(data.claim_code);
      setDonaWilmaNumber(data.dona_wilma_number);
      setExpiresAt(new Date(data.expires_at));
      setStep('waiting');
    } catch (err) {
      console.error('[Welcome] generateClaimCode error:', err);
      toast({
        title: t('welcome.sendError'),
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Polling: a cada 3s checa se a sessão WhatsApp foi criada
  useEffect(() => {
    if (step !== 'waiting' || !user) return;

    const tick = async () => {
      // Checar expiração
      if (expiresAt && expiresAt.getTime() < Date.now()) {
        setStep('expired');
        return;
      }

      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('phone_number')
        .eq('user_id', user.id)
        .maybeSingle();

      if (session) {
        setPhoneNumber(session.phone_number);
        setStep('connected');
        toast({
          title: t('welcome.successConnected'),
          description: session.phone_number,
        });
      }
    };

    tick();
    pollingRef.current = window.setInterval(tick, 3000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [step, user, expiresAt]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(claimCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleOpenWhatsApp = () => {
    const url = `https://wa.me/${donaWilmaNumber}?text=${encodeURIComponent(claimCode)}`;
    window.open(url, '_blank');
  };

  const handleGoToDashboard = () => {
    sessionStorage.setItem('onboarding_completed', 'true');
    sessionStorage.removeItem('redirected_to_welcome');
    navigate('/', { replace: true });
  };

  const isConnected = step === 'connected';

  // Formatar número para exibição: 5511932727575 → +55 11 93272-7575
  const formatDisplayNumber = (n: string) => {
    if (!n) return '';
    const d = n.replace(/\D/g, '');
    if (d.length === 13) return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,9)}-${d.slice(9)}`;
    if (d.length === 12) return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,8)}-${d.slice(8)}`;
    return `+${d}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F9FA] to-[#F8F9FA]/50 flex items-center justify-center px-4 py-8">
      <header className="fixed top-0 left-0 right-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src="/images/logo.png" alt="Dona Wilma" className="h-8" />
          <LanguageFlagSelector />
        </nav>
      </header>

      <div className="w-full max-w-[800px] mt-20 animate-fadeInUp">
        {/* Progress */}
        <div className="flex items-center justify-center gap-0 mb-12">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 lg:w-15 lg:h-15 rounded-full bg-success flex items-center justify-center text-white">
              <Check className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <span className="text-xs mt-2 text-success font-medium text-center max-w-[80px]">
              {t('welcome.stepAccountCreated')}
            </span>
          </div>
          <div className="w-[120px] h-[3px] bg-success mt-[-16px]" />
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 lg:w-15 lg:h-15 rounded-full bg-success flex items-center justify-center text-white">
              <Check className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <span className="text-xs mt-2 text-success font-medium text-center max-w-[80px]">
              {t('welcome.stepPaymentConfirmed', 'Pagamento confirmado')}
            </span>
          </div>
          <div className={`w-[120px] h-[3px] mt-[-16px] ${isConnected ? 'bg-success' : 'bg-muted-foreground/30'}`} />
          <div className="flex flex-col items-center">
            <div className={`w-12 h-12 lg:w-15 lg:h-15 rounded-full flex items-center justify-center ${
              isConnected
                ? 'bg-success text-white'
                : 'bg-primary text-white scale-110 shadow-[0_0_20px_rgba(43,91,132,0.3)]'
            }`}>
              {isConnected ? <Check className="h-5 w-5 lg:h-6 lg:w-6" /> : <MessageCircle className="h-5 w-5 lg:h-6 lg:w-6" />}
            </div>
            <span className={`text-xs mt-2 font-medium text-center max-w-[80px] ${
              isConnected ? 'text-success' : 'text-primary'
            }`}>
              {t('welcome.stepConnectWhatsApp')}
            </span>
          </div>
        </div>

        <div className="rounded-[24px] bg-card shadow-[0_8px_25px_rgba(43,91,132,0.08)] overflow-hidden">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-[#2B5B84] to-[#1e4a6b] p-8 lg:p-12 pb-8 text-center">
            <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
            <div className="text-[4rem] animate-bounceCustom mb-4">🎉</div>
            <h1 className="font-heading text-[2.5rem] text-white mb-2">
              {t('welcome.congratsTitle', { name: userName || t('welcome.defaultUser') })}
            </h1>
            <p className="text-white/90 text-lg">{t('welcome.congratsSubtitle')}</p>
          </div>

          <div className="p-8 lg:p-12">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-gradient-to-br from-[#25D366] to-[#1da851] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulseGlow shadow-[0_0_30px_rgba(37,211,102,0.3)]">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>

              <h2 className="text-2xl font-semibold text-[#2B5B84] mb-3">
                {t('welcome.connectWhatsApp')}
              </h2>

              {/* LOADING */}
              {step === 'loading' && (
                <div className="py-8 flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">{t('welcome.sending')}</p>
                </div>
              )}

              {/* WAITING — exibe claim code */}
              {step === 'waiting' && (
                <div className="max-w-[480px] mx-auto space-y-6">
                  <p className="text-muted-foreground text-base">
                    {t('welcome.claimCodeInstruction')}
                  </p>

                  {/* Claim code box */}
                  <div className="relative">
                    <div className="bg-gradient-to-br from-[#F0F9F4] to-[#E8F5ED] border-2 border-dashed border-[#25D366] rounded-[20px] p-6">
                      <div className="text-[2.75rem] font-mono font-bold tracking-[0.15em] text-[#1a4d2e] select-all">
                        {claimCode}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="absolute top-3 right-3 rounded-full"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      {copied ? t('welcome.copied') : t('welcome.copyCode')}
                    </Button>
                  </div>

                  {/* Destinatário */}
                  <div className="bg-muted/40 rounded-[16px] p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-sm text-left">
                      <div className="text-muted-foreground">{t('welcome.sendTo')}</div>
                      <div className="font-semibold text-foreground">
                        📱 {formatDisplayNumber(donaWilmaNumber)}
                      </div>
                    </div>
                    <Button
                      onClick={handleOpenWhatsApp}
                      className="bg-gradient-to-r from-[#25D366] to-[#1da851] text-white rounded-full shadow-md hover:-translate-y-0.5 transition"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {t('welcome.openWhatsApp')}
                    </Button>
                  </div>

                  {/* Status aguardando */}
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('welcome.waitingMessage')}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateClaimCode}
                    disabled={isGenerating}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t('welcome.generateNewCode')}
                  </Button>
                </div>
              )}

              {/* EXPIRED */}
              {step === 'expired' && (
                <div className="max-w-[400px] mx-auto space-y-4 py-4">
                  <p className="text-muted-foreground">{t('welcome.expiredCode')}</p>
                  <Button
                    onClick={generateClaimCode}
                    disabled={isGenerating}
                    className="bg-gradient-to-r from-[#25D366] to-[#1da851] text-white rounded-full"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {t('welcome.generateNewCode')}
                  </Button>
                </div>
              )}

              {/* CONNECTED */}
              {step === 'connected' && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{t('welcome.connected')}</h3>
                  <p className="text-muted-foreground mb-2">
                    {t('welcome.number')} {phoneNumber}
                  </p>
                  <Badge variant="secondary" className="mb-4">
                    {t('welcome.readyToUse')}
                  </Badge>
                </div>
              )}
            </div>

            {/* Tips Grid */}
            <div className="bg-[#2B5B84]/[0.03] rounded-[20px] p-8 mb-8">
              <h3 className="text-xl font-semibold text-center mb-6 flex items-center justify-center gap-2">
                💡 {t('welcome.tipsHowTo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF]">
                  <div className="text-[2rem] mb-3">💰</div>
                  <h4 className="font-semibold mb-2">{t('welcome.tipExpenses')}</h4>
                  <p className="text-sm text-muted-foreground">{t('welcome.tipExpensesExample')}</p>
                </div>
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF]">
                  <div className="text-[2rem] mb-3">📈</div>
                  <h4 className="font-semibold mb-2">{t('welcome.tipIncome')}</h4>
                  <p className="text-sm text-muted-foreground">{t('welcome.tipIncomeExample')}</p>
                </div>
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF]">
                  <div className="text-[2rem] mb-3">📊</div>
                  <h4 className="font-semibold mb-2">{t('welcome.tipBalance')}</h4>
                  <p className="text-sm text-muted-foreground">{t('welcome.tipBalanceExample')}</p>
                </div>
                <div className="bg-white rounded-[16px] p-6 text-center shadow-[0_2px_10px_rgba(43,91,132,0.05)] border border-[#E9ECEF]">
                  <div className="text-[2rem] mb-3">📸</div>
                  <h4 className="font-semibold mb-2">{t('welcome.tipPhotos')}</h4>
                  <p className="text-sm text-muted-foreground">{t('welcome.tipPhotosExample')}</p>
                </div>
              </div>
            </div>

            <div className="text-center space-y-3">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#25D366] to-[#1da851] text-white rounded-full px-12 py-4 text-lg font-bold shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:-translate-y-0.5 transition"
                onClick={handleGoToDashboard}
              >
                🚀 {t('welcome.startUsing')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              {step !== 'connected' && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGoToDashboard}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t('welcome.skipForNow')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
