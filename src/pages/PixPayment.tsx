import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Copy, Loader2, QrCode, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { getStoredReferralCode, clearReferralCode } from "@/lib/referral";

type Stage = "form" | "creating" | "waiting" | "approved" | "failed" | "expired";

interface PixData {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string | null;
  expiresAt: string;
  amount: number;
}

const maskCpf = (raw: string) =>
  raw
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default function PixPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const location = useLocation();
  const pendingSignup = (location.state ?? null) as
    | { userId: string; email: string; referralCode: string | null }
    | null;

  const cycleParam = searchParams.get("cycle");
  const cycle: "monthly" | "yearly" =
    cycleParam === "yearly" ? "yearly" : "monthly";

  // Signup hands over credentials when no session exists yet (email confirmation).
  const authBody = session
    ? {}
    : { userId: pendingSignup?.userId, email: pendingSignup?.email };

  const [stage, setStage] = useState<Stage>("form");
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState<PixData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [failReason, setFailReason] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!authLoading && !session && !pendingSignup?.userId) {
      navigate("/choose-plan", { replace: true });
    }
  }, [authLoading, session, pendingSignup, navigate]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const handleCreate = async () => {
    if (cpf.replace(/\D/g, "").length !== 11) {
      toast({
        title: t("pix.invalidCpfTitle", "CPF inválido"),
        description: t("pix.invalidCpfDesc", "Digite os 11 números do seu CPF."),
        variant: "destructive",
      });
      return;
    }

    setStage("creating");
    const referralCode = pendingSignup?.referralCode ?? getStoredReferralCode();

    const { data, error } = await supabase.functions.invoke("create-pix-payment", {
      body: {
        cycle,
        cpf: cpf.replace(/\D/g, ""),
        payer_name: session?.user?.user_metadata?.full_name ?? "",
        referral_code: referralCode || undefined,
        ...authBody,
      },
    });

    if (error || !data?.qrCode) {
      let code = "";
      try {
        code = (await (error as any)?.context?.json())?.error ?? "";
      } catch {
        code = "";
      }
      setStage("form");
      toast({
        title:
          code === "INVALID_CPF"
            ? t("pix.invalidCpfTitle", "CPF inválido")
            : t("pix.createErrorTitle", "Não foi possível gerar o Pix"),
        description:
          code === "INVALID_CPF"
            ? t("pix.invalidCpfDesc", "Confira os números e tente novamente.")
            : t("pix.createErrorDesc", "Tente novamente em alguns instantes."),
        variant: "destructive",
      });
      return;
    }

    setPix(data as PixData);
    setStage("waiting");
  };

  useEffect(() => {
    if (stage !== "waiting" || !pix) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(pix.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining === 0) {
        stopPolling();
        setStage("expired");
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [stage, pix, stopPolling]);

  useEffect(() => {
    if (stage !== "waiting" || !pix) return;

    const check = async () => {
      const { data, error } = await supabase.functions.invoke("check-pix-payment", {
        body: { paymentId: pix.paymentId, ...authBody },
      });
      if (error || !data?.status) return;

      if (data.status === "approved") {
        stopPolling();
        clearReferralCode();
        setStage("approved");
        window.setTimeout(() => navigate("/boas-vindas", { replace: true }), 2500);
      } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(data.status)) {
        stopPolling();
        setFailReason(data.statusDetail ?? null);
        setStage("failed");
      }
    };

    pollRef.current = window.setInterval(check, 4000);
    return stopPolling;
  }, [stage, pix, navigate, stopPolling]);

  const copyCode = async () => {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.qrCode);
    toast({
      title: t("pix.copiedTitle", "Código copiado"),
      description: t("pix.copiedDesc", "Cole no app do seu banco para pagar."),
    });
  };

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
        <Loader2 className="h-10 w-10 animate-spin text-green-600 dark:text-green-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-background">
      <Card className="max-w-md w-full shadow-xl">
        {stage === "form" || stage === "creating" ? (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                  <QrCode className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle>{t("pix.formTitle", "Pagamento via Pix")}</CardTitle>
              <CardDescription>
                {t(
                  "pix.formDesc",
                  "O Mercado Pago exige o CPF do pagador para gerar o Pix."
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">{t("pix.cpfLabel", "CPF")}</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  disabled={stage === "creating"}
                />
              </div>
              <Button
                onClick={handleCreate}
                className="w-full"
                size="lg"
                disabled={stage === "creating"}
              >
                {stage === "creating" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pix.generating", "Gerando código Pix...")}
                  </>
                ) : (
                  t("pix.generate", "Gerar código Pix")
                )}
              </Button>
            </CardContent>
          </>
        ) : null}

        {stage === "waiting" && pix ? (
          <>
            <CardHeader className="text-center">
              <CardTitle>{t("pix.waitingTitle", "Escaneie para pagar")}</CardTitle>
              <CardDescription>
                {t("pix.amountLabel", "Valor")}: R$ {pix.amount.toFixed(2).replace(".", ",")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pix.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt={t("pix.qrAlt", "QR Code do Pix")}
                  className="mx-auto w-56 h-56 rounded-lg border bg-white p-2"
                />
              ) : null}

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {t("pix.expiresIn", "Expira em")} {minutes}:{seconds}
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t("pix.copyPasteLabel", "Ou copie o código Pix")}
                </Label>
                <div className="flex gap-2">
                  <Input readOnly value={pix.qrCode} className="text-xs" />
                  <Button onClick={copyCode} variant="outline" size="icon" type="button">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {t("pix.autoDetect", "Assim que o pagamento cair, esta tela avança sozinha.")}
                </span>
              </div>
            </CardContent>
          </>
        ) : null}

        {stage === "approved" ? (
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">
              {t("pix.approvedTitle", "Pagamento confirmado!")}
            </h2>
            <p className="text-muted-foreground">
              {t("pix.approvedDesc", "Sua assinatura já está ativa. Levando você para o próximo passo...")}
            </p>
          </CardContent>
        ) : null}

        {stage === "failed" || stage === "expired" ? (
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                <XCircle className="h-14 w-14 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">
              {stage === "expired"
                ? t("pix.expiredTitle", "Código expirado")
                : t("pix.failedTitle", "Pagamento não concluído")}
            </h2>
            <p className="text-muted-foreground">
              {stage === "expired"
                ? t("pix.expiredDesc", "O código Pix venceu. Gere um novo para continuar.")
                : failReason ?? t("pix.failedDesc", "O pagamento não foi aprovado. Tente novamente.")}
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => {
                  setPix(null);
                  setFailReason(null);
                  setStage("form");
                }}
                className="w-full"
                size="lg"
              >
                {t("pix.retry", "Gerar novo código")}
              </Button>
              <Button
                onClick={() => navigate("/choose-plan")}
                variant="ghost"
                className="w-full"
                size="sm"
              >
                {t("pix.backToPlans", "Voltar para planos")}
              </Button>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
