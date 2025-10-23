import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  organization: {
    name: string;
  };
  inviter: {
    full_name: string;
    email: string;
  } | null;
}

export default function InviteAccept() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  useEffect(() => {
    // Se usuário já está logado e convite foi carregado, aceitar automaticamente
    if (user && invitation && !accepting && !success && !error) {
      acceptInvite();
    }
  }, [user, invitation]);

  async function loadInvitation() {
    if (!token) {
      setError('Token de convite inválido');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select(`
          *,
          organization:organizations(name)
        `)
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        setError('Convite inválido, expirado ou já utilizado');
        setLoading(false);
        return;
      }

      // Verificar se expirou
      if (new Date(data.expires_at) < new Date()) {
        setError('Este convite expirou');
        setLoading(false);
        return;
      }

      // Buscar perfil do convidador
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', data.invited_by)
        .single();

      setInvitation({
        ...data,
        inviter: inviterProfile || null
      } as Invitation);
    } catch (err) {
      console.error('Erro ao carregar convite:', err);
      setError('Erro ao carregar convite');
    } finally {
      setLoading(false);
    }
  }

  async function acceptInvite() {
    if (!user || !token) {
      // Redirecionar para login com redirect_to
      const returnUrl = encodeURIComponent(`/invite/${token}`);
      navigate(`/?redirect=${returnUrl}`);
      return;
    }

    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc('accept_organization_invite', {
        p_token: token,
        p_user_id: user.id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        setError(result.error || 'Erro ao aceitar convite');
        toast.error(result.error || 'Erro ao aceitar convite');
        return;
      }

      setSuccess(true);
      toast.success(result.message || 'Convite aceito com sucesso!');
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      console.error('Erro ao aceitar convite:', err);
      setError(err.message || 'Erro ao aceitar convite');
      toast.error('Erro ao aceitar convite');
    } finally {
      setAccepting(false);
    }
  }

  const roleLabels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    member: 'Membro'
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-center">Convite Inválido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Voltar para o Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">Convite Aceito!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Você agora faz parte de <strong>{invitation?.organization.name}</strong>!
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Redirecionando...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-center">Você foi convidado!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>{invitation?.inviter?.full_name || invitation?.inviter?.email || 'Alguém'}</strong> convidou você para:
            </p>
            <p className="text-lg font-semibold">{invitation?.organization.name}</p>
            <p className="text-sm text-muted-foreground">
              Como: <strong>{roleLabels[invitation?.role || ''] || invitation?.role}</strong>
            </p>
          </div>

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Faça login ou crie uma conta para aceitar o convite
              </p>
              <Button onClick={acceptInvite} className="w-full" size="lg">
                Continuar
              </Button>
            </div>
          ) : accepting ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Aceitando convite...</p>
            </div>
          ) : (
            <Button onClick={acceptInvite} className="w-full" size="lg">
              Aceitar Convite
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Este convite expira em {new Date(invitation?.expires_at || '').toLocaleDateString('pt-BR')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
