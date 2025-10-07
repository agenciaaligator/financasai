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
import { Shield, Crown, Star, User as UserIcon, Sparkles } from "lucide-react";
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
        .select('user_id, full_name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.user_id) || [];
      
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
          email: 'user@email.com', // Precisaria de uma edge function para buscar do auth
          full_name: profile.full_name || 'Sem nome',
          created_at: profile.created_at,
          role: validRole,
          planName: (subscription?.subscription_plans as any)?.name || 'Gratuito',
          subscriptionStatus: subscription?.status || 'inactive',
          trialExpiresAt: trialRole?.expires_at || null,
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

  const handleRoleChange = async (userId: string, newRole: 'free' | 'premium' | 'admin') => {
    // Proteção: não permite que admin remova próprio acesso admin
    if (userId === currentUser?.id && newRole !== 'admin') {
      const confirmRemoval = window.confirm(
        'ATENÇÃO: Você está removendo seu próprio acesso de admin. Tem certeza?'
      );
      if (!confirmRemoval) return;
    }

    try {
      if (newRole === 'admin') {
        // Para admin: upsert (adiciona sem remover outras roles)
        const { error } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: newRole, expires_at: null }, { onConflict: 'user_id,role' });
        
        if (error) throw error;
        toast.success('Acesso admin concedido!');
      } else {
        // Para free/premium: remove admin e trial, define nova role
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'trial');
        
        const { error } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: newRole, expires_at: null }, { onConflict: 'user_id,role' });
        
        if (error) throw error;
        toast.success('Role atualizada com sucesso!');
      }

      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      toast.error('Erro ao atualizar role');
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
              <TableHead>Role Atual</TableHead>
              <TableHead>Plano Ativo</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getRoleBadge(user.role)}
                    {user.role === 'trial' && user.trialExpiresAt && (
                      <span className="text-xs text-muted-foreground">
                        Expira: {new Date(user.trialExpiresAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{user.planName}</Badge>
                  {user.subscriptionStatus === 'active' && (
                    <Badge variant="outline" className="ml-2 bg-success/10 text-success">
                      Ativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Select
                      value={user.role === 'trial' ? 'free' : user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value as 'free' | 'premium' | 'admin')}
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
                    
                    {user.role !== 'trial' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActivateTrial(user.id)}
                        disabled={activatingTrial === user.id}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        {activatingTrial === user.id ? 'Ativando...' : 'Trial 14d'}
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
