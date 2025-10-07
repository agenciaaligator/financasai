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
import { Shield, Crown, Star, User as UserIcon } from "lucide-react";

interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role: 'free' | 'trial' | 'premium' | 'admin';
}

export function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Buscar emails do auth.users via edge function ou outro método
      // Por enquanto, vamos buscar roles
      const userIds = profiles?.map(p => p.user_id) || [];
      
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) throw rolesError;

      // Combinar dados
      const usersData = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        const roleValue = userRole?.role || 'free';
        const validRole = ['free', 'trial', 'premium', 'admin'].includes(roleValue) 
          ? roleValue as 'free' | 'trial' | 'premium' | 'admin'
          : 'free';
        
        return {
          id: profile.user_id,
          email: 'user@email.com', // Precisaria de uma edge function para buscar do auth
          full_name: profile.full_name || 'Sem nome',
          created_at: profile.created_at,
          role: validRole,
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

  const handleRoleChange = async (userId: string, newRole: 'free' | 'trial' | 'premium' | 'admin') => {
    try {
      // Atualizar role
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Role atualizada com sucesso!');
      fetchUsers();
    } catch (error) {
      console.error('Erro ao atualizar role:', error);
      toast.error('Erro ao atualizar role');
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
              <TableHead>Role</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  {new Date(user.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(value) => handleRoleChange(user.id, value as 'free' | 'trial' | 'premium' | 'admin')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Gratuito</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
