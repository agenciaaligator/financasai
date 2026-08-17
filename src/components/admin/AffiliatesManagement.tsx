import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Users, Plus, Check } from "lucide-react";

interface Affiliate {
  id: string;
  name: string;
  referral_code: string;
  pix_key: string | null;
  commission_type: "fixed" | "percent";
  commission_value_monthly: number;
  commission_value_yearly: number;
  active: boolean;
}

interface Referral {
  id: string;
  affiliate_id: string;
  referred_email: string | null;
  plan_name: string | null;
  amount_paid: number | null;
  commission_amount: number;
  status: "pending" | "paid";
  created_at: string;
}

export function AffiliatesManagement() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [commissionType, setCommissionType] = useState<"fixed" | "percent">("fixed");
  const [commissionMonthly, setCommissionMonthly] = useState("5");
  const [commissionYearly, setCommissionYearly] = useState("20");

  const load = async () => {
    setLoading(true);
    const [{ data: aff }, { data: refs }] = await Promise.all([
      supabase.from("affiliates").select("*").order("created_at", { ascending: false }),
      supabase.from("affiliate_referrals").select("*").order("created_at", { ascending: false }),
    ]);
    setAffiliates((aff as Affiliate[]) ?? []);
    setReferrals((refs as Referral[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const affiliateName = (id: string) => affiliates.find((a) => a.id === id)?.name ?? "—";

  const createAffiliate = async () => {
    if (!name.trim() || !code.trim()) {
      toast({ title: "Preencha nome e código", variant: "destructive" });
      return;
    }
    const parsedMonthly = Number(commissionMonthly.replace(",", "."));
    const parsedYearly = Number(commissionYearly.replace(",", "."));
    if (Number.isNaN(parsedMonthly) || parsedMonthly < 0 || Number.isNaN(parsedYearly) || parsedYearly < 0) {
      toast({ title: "Valor de comissão inválido", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("affiliates").insert({
      name: name.trim(),
      referral_code: code.trim().toUpperCase(),
      pix_key: pixKey.trim() || null,
      commission_type: commissionType,
      commission_value_monthly: parsedMonthly,
      commission_value_yearly: parsedYearly,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro ao criar afiliado", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Afiliado criado", description: `Link: donawilma.com.br/?ref=${code.trim().toUpperCase()}` });
    setName("");
    setCode("");
    setPixKey("");
    setCommissionMonthly("5");
    setCommissionYearly("20");
    load();
  };

  const toggleActive = async (a: Affiliate) => {
    const { error } = await supabase.from("affiliates").update({ active: !a.active }).eq("id", a.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const markPaid = async (r: Referral) => {
    const { error } = await supabase
      .from("affiliate_referrals")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Erro ao marcar como pago", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marcado como pago" });
    load();
  };

  const pendingTotal = referrals
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + Number(r.commission_amount), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Novo afiliado
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Padaria do João" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Código (link/QR)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PADARIA10" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Chave Pix</Label>
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="opcional" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={commissionType} onValueChange={(v) => setCommissionType(v as "fixed" | "percent")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">R$ fixo</SelectItem>
                <SelectItem value="percent">% do plano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Comissão — Mensal</Label>
            <Input
              type="number"
              min="0"
              value={commissionMonthly}
              onChange={(e) => setCommissionMonthly(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Comissão — Anual</Label>
            <Input
              type="number"
              min="0"
              value={commissionYearly}
              onChange={(e) => setCommissionYearly(e.target.value)}
            />
          </div>
          <Button onClick={createAffiliate} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            Criar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Afiliados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : affiliates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum afiliado cadastrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Comissão mensal</TableHead>
                  <TableHead>Comissão anual</TableHead>
                  <TableHead>Pix</TableHead>
                  <TableHead className="text-right">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="font-mono text-xs">donawilma.com.br/?ref={a.referral_code}</TableCell>
                    <TableCell>
                      {a.commission_type === "percent"
                        ? `${a.commission_value_monthly}%`
                        : `R$ ${Number(a.commission_value_monthly).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      {a.commission_type === "percent"
                        ? `${a.commission_value_yearly}%`
                        : `R$ ${Number(a.commission_value_yearly).toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.pix_key ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Switch checked={a.active} onCheckedChange={() => toggleActive(a)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Comissões
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pendente de pagamento: <strong>R$ {pendingTotal.toFixed(2)}</strong>
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma indicação registrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Cliente indicado</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{affiliateName(r.affiliate_id)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.referred_email ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.plan_name ?? "—"}</TableCell>
                    <TableCell className="text-right">R$ {Number(r.commission_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "paid" ? "secondary" : "destructive"}>
                        {r.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => markPaid(r)}>
                          <Check className="h-3 w-3 mr-1" />
                          Marcar pago
                        </Button>
                      )}
                    </TableCell>
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
