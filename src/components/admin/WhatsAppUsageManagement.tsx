import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MessageCircle, Save } from "lucide-react";

interface Row {
  user_id: string;
  email: string | null;
  plan_name: string | null;
  limite: number | null;
  qtd_atual: number;
  percentual: number;
  custo_estimado: number;
}

export function WhatsAppUsageManagement() {
  const [cost, setCost] = useState<number>(0.05);
  const [costInput, setCostInput] = useState<string>("0.05");
  const [savingCost, setSavingCost] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCost = async () => {
    const { data } = await supabase
      .from("whatsapp_cost_config")
      .select("custo_por_mensagem_brl")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      const v = Number(data.custo_por_mensagem_brl);
      setCost(v);
      setCostInput(v.toString());
    }
  };

  const loadRows = async (unitCost: number) => {
    setLoading(true);
    // Get all users with subscription + plan
    const { data: subs } = await supabase
      .from("user_subscriptions")
      .select("user_id, subscription_plans(name, limite_mensagens_mes)")
      .in("status", ["active", "trialing", "past_due"]);

    if (!subs) {
      setRows([]);
      setLoading(false);
      return;
    }

    const userIds = subs.map((s: any) => s.user_id);
    if (userIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: profiles }, { data: usage }] = await Promise.all([
      supabase.from("profiles").select("user_id, email").in("user_id", userIds),
      supabase
        .from("usage_mensagens")
        .select("user_id, qtd_mensagens_cobradas, ciclo_inicio")
        .in("user_id", userIds)
        .order("ciclo_inicio", { ascending: false }),
    ]);

    const emailMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.email]));
    const usageMap = new Map<string, number>();
    (usage ?? []).forEach((u: any) => {
      if (!usageMap.has(u.user_id)) usageMap.set(u.user_id, u.qtd_mensagens_cobradas);
    });

    const built: Row[] = subs.map((s: any) => {
      const qtd = usageMap.get(s.user_id) ?? 0;
      const limite = s.subscription_plans?.limite_mensagens_mes ?? null;
      const pct = limite && limite > 0 ? Math.round((qtd / limite) * 10000) / 100 : 0;
      return {
        user_id: s.user_id,
        email: emailMap.get(s.user_id) ?? null,
        plan_name: s.subscription_plans?.name ?? null,
        limite,
        qtd_atual: qtd,
        percentual: pct,
        custo_estimado: Math.round(qtd * unitCost * 100) / 100,
      };
    });

    built.sort((a, b) => b.percentual - a.percentual);
    setRows(built);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await loadCost();
    })();
  }, []);

  useEffect(() => {
    loadRows(cost);
  }, [cost]);

  const saveCost = async () => {
    const parsed = Number(costInput.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({ title: "Valor inválido", description: "Digite um número em reais.", variant: "destructive" });
      return;
    }
    setSavingCost(true);
    const { error } = await supabase
      .from("whatsapp_cost_config")
      .update({ custo_por_mensagem_brl: parsed, atualizado_em: new Date().toISOString() })
      .eq("id", 1);
    setSavingCost(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setCost(parsed);
    toast({ title: "Custo atualizado", description: `Agora: R$ ${parsed.toFixed(4)} por mensagem.` });
  };

  const totalCost = rows.reduce((s, r) => s + r.custo_estimado, 0);
  const totalMsgs = rows.reduce((s, r) => s + r.qtd_atual, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" />
            Custo por mensagem WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-xs text-muted-foreground">Valor em R$ (por mensagem cobrável)</label>
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
            />
          </div>
          <Button onClick={saveCost} disabled={savingCost}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uso e custo estimado por assinante</CardTitle>
          <p className="text-xs text-muted-foreground">
            Total do ciclo atual: <strong>{totalMsgs.toLocaleString("pt-BR")}</strong> mensagens ·{" "}
            <strong>R$ {totalCost.toFixed(2)}</strong>
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum assinante ativo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Mensagens</TableHead>
                  <TableHead className="text-right">Franquia</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Custo est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="max-w-[220px] truncate">{r.email ?? r.user_id}</TableCell>
                    <TableCell className="capitalize">{r.plan_name ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.qtd_atual.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      {r.limite ? r.limite.toLocaleString("pt-BR") : "∞"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        r.percentual >= 100
                          ? "text-destructive"
                          : r.percentual >= 80
                          ? "text-yellow-600"
                          : ""
                      }`}
                    >
                      {r.limite ? `${r.percentual.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">R$ {r.custo_estimado.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
