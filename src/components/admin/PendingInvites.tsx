import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, X, Copy, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  created_at: string;
  expires_at: string;
  inviter: {
    full_name: string;
  };
}

interface PendingInvitesProps {
  organizationId: string;
}

export function PendingInvites({ organizationId }: PendingInvitesProps) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvites();
  }, [organizationId]);

  async function fetchInvites() {
    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select(`
          *,
          inviter:profiles!organization_invitations_invited_by_fkey(full_name)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar convites:', error);
      toast.error('Erro ao carregar convites');
    } finally {
      setLoading(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    try {
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);

      if (error) throw error;

      toast.success('Convite cancelado');
      fetchInvites();
    } catch (error: any) {
      console.error('Erro ao cancelar convite:', error);
      toast.error('Erro ao cancelar convite');
    }
  }

  function copyInviteLink(token: string) {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Link copiado!');
  }

  const roleLabels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Admin',
    member: 'Membro'
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Convites Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Convites Pendentes
          {invites.length > 0 && (
            <Badge variant="secondary">{invites.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum convite pendente
          </p>
        ) : (
          <div className="space-y-3">
            {invites.map(invite => (
              <div 
                key={invite.id} 
                className="flex items-start justify-between p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{invite.email}</p>
                    <Badge variant="outline">{roleLabels[invite.role] || invite.role}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Convidado por {invite.inviter?.full_name || 'Desconhecido'}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Enviado {formatDistanceToNow(new Date(invite.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyInviteLink(invite.token)}
                    title="Copiar link do convite"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => cancelInvite(invite.id)}
                    className="text-destructive hover:text-destructive"
                    title="Cancelar convite"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
