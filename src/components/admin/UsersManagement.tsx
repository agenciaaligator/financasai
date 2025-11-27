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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Crown, Star, User as UserIcon, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role: 'free' | 'trial' | 'premium' | 'admin';
  planName: string;
  subscriptionStatus: string;
  trialExpiresAt: string | null;
  isMaster: boolean;
}

export function UsersManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingTrial, setActivatingTrial] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.user_id) || [];

      // Buscar master users
      const { data: masterUsers } = await supabase
        .from('master_users')
        .select('user_id')
        .in('user_id', userIds);

      const masterUserIds = new Set(masterUsers?.map(m => m.user_id) || []);
      
      // Buscar role via RPC (highest priority role)
      const rolesPromises = userIds.map(async (userId) => {
        const { data } = await supabase.rpc('get_user_role', { _user_id: userId });
        return { user_id: userId, role: data || 'free' };
      });
      const roles = await Promise.all(rolesPromises);

      // Buscar subscriptions
      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_id, status, current_period_end, subscription_plans(name)')
        .in('user_id', userIds);

      // Buscar trial expiration
      const { data: trialRoles } = await supabase
        .from('user_roles')
        .select('user_id, expires_at')
        .in('user_id', userIds)
        .eq('role', 'trial');

      // Combinar dados
      const usersData = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        const roleValue = userRole?.role || 'free';
        const validRole = ['free', 'trial', 'premium', 'admin'].includes(roleValue) 
          ? roleValue as 'free' | 'trial' | 'premium' | 'admin'
          : 'free';
        
        const subscription = subscriptions?.find(s => s.user_id === profile.user_id);
        const trialRole = trialRoles?.find(t => t.user_id === profile.user_id);
        
        return {
          id: profile.user_id,
          email: profile.email || 'Sem email',
          full_name: profile.full_name || 'Sem nome',
          created_at: profile.created_at,
          role: validRole,
          planName: (subscription?.subscription_plans as any)?.name || 'Gratuito',
          subscriptionStatus: subscription?.status || 'inactive',
          trialExpiresAt: trialRole?.expires_at || null,
          isMaster: masterUserIds.has(profile.user_id),
        };
      }) || [];

      setUsers(usersData);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'free' | 'premium' | 'admin', userEmail: string) => {
    console.log('[UsersManagement] Alterando role:', { userId, newRole, userEmail });

    try {
      // Verificar se é master user
      const { data: isMaster } = await supabase.rpc('is_master_user', { _user_id: userId });
      
      if (isMaster && newRole !== 'admin') {
        toast.error('❌ Não é possível alterar a role do usuário master. O master deve sempre ser admin.');
        return;
      }

      // Deletar TODAS as roles antigas do usuário
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('[UsersManagement] Erro ao deletar roles antigas:', deleteError);
        throw new Error(`Erro ao deletar roles: ${deleteError.message}`);
      }

      // Inserir nova role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ 
          user_id: userId, 
          role: newRole,
          expires_at: newRole === 'admin' ? null : undefined
        });

      if (insertError) {
        console.error('[UsersManagement] Erro ao inserir nova role:', insertError);
        throw new Error(`Erro ao inserir role: ${insertError.message}`);
      }

      console.log('[UsersManagement] ✅ Role alterada com sucesso para:', newRole);
      toast.success(`✅ Role alterada para ${newRole} com sucesso!`);
      fetchUsers();
    } catch (error: any) {
      console.error('[UsersManagement] ❌ Erro ao atualizar permissão:', error);
      toast.error(`❌ ${error.message || 'Falha ao atualizar permissão'}`);
    }
  };

  const handleActivateTrial = async (userId: string) => {
    setActivatingTrial(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Chamar edge function activate-trial como admin para outro usuário
      const { error } = await supabase.functions.invoke('activate-trial', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`
        },
        body: { user_id: userId }
      });

      if (error) throw error;

      toast.success('Trial de 14 dias ativado com sucesso!');
      fetchUsers();
    } catch (error: any) {
      console.error('Erro ao ativar trial:', error);
      toast.error(error.message || 'Erro ao ativar trial');
    } finally {
      setActivatingTrial(null);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    console.log(`[DELETE USER] Iniciando exclusão de ${userEmail} (${userId})`);
    
    // 1. VERIFICAÇÕES DE SEGURANÇA
    if (userId === currentUser?.id) {
      toast.error('❌ Você não pode excluir sua própria conta pelo admin panel');
      return;
    }
    
    // Verificar se é master
    const { data: isMaster } = await supabase.rpc('is_master_user', { _user_id: userId });
    if (isMaster) {
      toast.error('❌ Não é possível excluir o usuário master');
      return;
    }
    
    // 2. CONFIRMAÇÃO DO USUÁRIO
    const confirmed = window.confirm(
      `⚠️ ATENÇÃO: Você está prestes a EXCLUIR permanentemente:\n\n` +
      `Email: ${userEmail}\n` +
      `ID: ${userId}\n\n` +
      `Isso irá APAGAR:\n` +
      `- Todas as transações\n` +
      `- Todos os compromissos\n` +
      `- Todas as categorias\n` +
      `- Conexões do WhatsApp e Google Calendar\n` +
      `- Membros de organizações\n` +
      `- TODOS os dados do usuário\n\n` +
      `Esta ação é IRREVERSÍVEL!\n\n` +
      `Deseja continuar?`
    );
    
    if (!confirmed) {
      console.log('[DELETE USER] Exclusão cancelada pelo usuário');
      return;
    }
    
    setLoading(true);
    
    try {
      // 3. CHAMAR EDGE FUNCTION (substitui toda a lógica de exclusão manual)
      console.log('[DELETE USER] Chamando edge function delete-user-admin...');
      
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('delete-user-admin', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`
        },
        body: { user_id: userId }
      });
      
      if (error) {
        console.error('[DELETE USER] Erro retornado pela edge function:', error);
        throw new Error(error.message || 'Falha ao excluir usuário');
      }
      
      if (!data?.success) {
        console.error('[DELETE USER] Edge function retornou falha:', data);
        throw new Error(data?.error || 'Falha ao excluir usuário');
      }
      
      console.log(`[DELETE USER] ✅ Usuário ${userEmail} excluído com sucesso!`);
      toast.success(`✅ Usuário ${userEmail} excluído permanentemente`);
      
      // Aguardar recarregamento completar ANTES de desativar loading
      await fetchUsers();
      
    } catch (error: any) {
      console.error('[DELETE USER] ❌ Erro durante exclusão:', error);
      toast.error(`❌ Erro ao excluir usuário: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { icon: Shield, color: 'bg-destructive text-destructive-foreground', label: 'Admin' },
      premium: { icon: Crown, color: 'bg-success text-success-foreground', label: 'Premium' },
      trial: { icon: Star, color: 'bg-accent text-accent-foreground', label: 'Trial' },
      free: { icon: UserIcon, color: 'bg-muted text-muted-foreground', label: 'Gratuito' },
    };

    const badge = badges[role as keyof typeof badges] || badges.free;
    const Icon = badge.icon;

    return (
      <Badge className={badge.color}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Carregando usuários...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Usuários</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.full_name}
                  {user.isMaster && (
                    <Badge variant="secondary" className="ml-2 bg-purple-500 text-white">
                      Master
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getRoleBadge(user.role)}
                    {user.role === 'trial' && user.trialExpiresAt && (
                      <span className="text-xs text-muted-foreground">
                        Expira: {new Date(user.trialExpiresAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {user.subscriptionStatus === 'active' && (
                      <Badge variant="outline" className="ml-2 bg-success/10 text-success text-xs">
                        {user.planName}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Select
                      value={user.role === 'trial' ? 'free' : user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as 'free' | 'premium' | 'admin', user.email)}
                      disabled={user.isMaster}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Gratuito</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    {!user.isMaster && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={loading}
                        title="Excluir usuário permanentemente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
