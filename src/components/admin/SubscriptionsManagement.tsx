import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, Calendar } from "lucide-react";

interface Subscription {
  id: string;
  user_name: string;
  plan_name: string;
  status: string;
  billing_cycle: string;
  current_period_end: string;
  created_at: string;
}

export function SubscriptionsManagement() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          status,
          billing_cycle,
          current_period_end,
          created_at,
          subscription_plans(display_name, name),
          user_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar assinaturas "free" (não devem aparecer)
      const filteredData = data?.filter(sub => {
        const planName = (sub as any).subscription_plans?.name;
        return planName !== 'free';
      }) || [];

      // Buscar nomes dos usuários
      const userIds = filteredData.map(s => (s as any).user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const subsData = filteredData.map(sub => {
        const profile = profiles?.find(p => p.user_id === (sub as any).user_id);
        return {
          id: sub.id,
          user_name: profile?.full_name || 'Desconhecido',
          plan_name: (sub as any).subscription_plans?.display_name || 'N/A',
          status: sub.status,
          billing_cycle: sub.billing_cycle || 'monthly',
          current_period_end: sub.current_period_end || '',
          created_at: sub.created_at,
        };
      });

      setSubscriptions(subsData);
    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error);
      toast.error('Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled', cancel_at_period_end: true })
        .eq('id', subscriptionId);

      if (error) throw error;

      toast.success('Assinatura cancelada com sucesso!');
      fetchSubscriptions();
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast.error('Erro ao cancelar assinatura');
    }
  };

  const getStatusBadge = (status: string) => {
    const active = status === 'active';
    return (
      <Badge className={active ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}>
        {active ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
        {active ? 'Ativa' : 'Cancelada'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando assinaturas...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const inactiveSubscriptions = subscriptions.filter(s => s.status !== 'active');

  return (
    <div className="space-y-6">
      {/* Assinaturas Ativas */}
      <Card>
        <CardHeader>
          <CardTitle>Assinaturas Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSubscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma assinatura ativa no momento
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Próximo Pagamento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSubscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.user_name}</TableCell>
                    <TableCell>{sub.plan_name}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell className="capitalize">
                      {sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {sub.current_period_end 
                          ? new Date(sub.current_period_end).toLocaleDateString('pt-BR')
                          : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelSubscription(sub.id)}
                      >
                        Cancelar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Assinaturas Recentes (Não Ativas) */}
      {inactiveSubscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assinaturas Recentes (Não Ativas)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Data de Criação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveSubscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.user_name}</TableCell>
                    <TableCell>{sub.plan_name}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell className="capitalize">
                      {sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                    </TableCell>
                    <TableCell>
                      {sub.created_at 
                        ? new Date(sub.created_at).toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
