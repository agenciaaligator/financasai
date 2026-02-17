import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Shield, Crown, Star, User as UserIcon, Trash2 } from "lucide-react";
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
  const { t } = useTranslation();
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

      const { data: masterUsers } = await supabase
        .from('master_users')
        .select('user_id')
        .in('user_id', userIds);

      const masterUserIds = new Set(masterUsers?.map(m => m.user_id) || []);
      
      const rolesPromises = userIds.map(async (userId) => {
        const { data } = await supabase.rpc('get_user_role', { _user_id: userId });
        return { user_id: userId, role: data || 'free' };
      });
      const roles = await Promise.all(rolesPromises);

      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_id, status, current_period_end, subscription_plans(name)')
        .in('user_id', userIds);

      const { data: trialRoles } = await supabase
        .from('user_roles')
        .select('user_id, expires_at')
        .in('user_id', userIds)
        .eq('role', 'trial');

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
          email: profile.email || t('admin.noEmail'),
          full_name: profile.full_name || t('admin.noName'),
          created_at: profile.created_at,
          role: validRole,
          planName: (subscription?.subscription_plans as any)?.name || t('admin.noSubscription'),
          subscriptionStatus: subscription?.status || 'inactive',
          trialExpiresAt: trialRole?.expires_at || null,
          isMaster: masterUserIds.has(profile.user_id),
        };
      }) || [];

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('admin.loadUsersError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'free' | 'premium' | 'admin', userEmail: string) => {
    try {
      const { data: isMaster } = await supabase.rpc('is_master_user', { _user_id: userId });
      
      if (isMaster && newRole !== 'admin') {
        toast.error(`❌ ${t('admin.cannotChangeMaster')}`);
        return;
      }

      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw new Error(deleteError.message);

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ 
          user_id: userId, 
          role: newRole,
          expires_at: newRole === 'admin' ? null : undefined
        });

      if (insertError) throw new Error(insertError.message);

      toast.success(`✅ ${t('admin.roleChanged', { role: newRole })}`);
      fetchUsers();
    } catch (error: any) {
      toast.error(`❌ ${error.message || t('admin.roleChangeError')}`);
    }
  };

  const handleActivateTrial = async (userId: string) => {
    setActivatingTrial(userId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('activate-trial', {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
        body: { user_id: userId }
      });

      if (error) throw error;

      toast.success(t('admin.trialActivated'));
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || t('admin.trialActivateError'));
    } finally {
      setActivatingTrial(null);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userId === currentUser?.id) {
      toast.error(`❌ ${t('admin.cannotDeleteSelf')}`);
      return;
    }
    
    const { data: isMaster } = await supabase.rpc('is_master_user', { _user_id: userId });
    if (isMaster) {
      toast.error(`❌ ${t('admin.cannotDeleteMaster')}`);
      return;
    }
    
    const confirmed = window.confirm(
      `⚠️ ${t('admin.deleteConfirmTitle')}\n\n` +
      `${t('admin.deleteConfirmEmail', { email: userEmail })}\n` +
      `${t('admin.deleteConfirmId', { id: userId })}\n\n` +
      t('admin.deleteConfirmWarning')
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('delete-user-admin', {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
        body: { user_id: userId }
      });
      
      if (error) throw new Error(error.message || t('admin.deleteError'));
      if (!data?.success) throw new Error(data?.error || t('admin.deleteError'));
      
      toast.success(`✅ ${t('admin.userDeleted', { email: userEmail })}`);
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      await fetchUsers();
    } catch (error: any) {
      toast.error(`❌ ${t('admin.deleteError')}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { icon: Shield, color: 'bg-destructive text-destructive-foreground', label: t('admin.admin_role') },
      premium: { icon: Crown, color: 'bg-success text-success-foreground', label: t('admin.premium') },
      trial: { icon: Star, color: 'bg-accent text-accent-foreground', label: t('admin.trial') },
      free: { icon: UserIcon, color: 'bg-muted text-muted-foreground', label: t('admin.noSubscription') },
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
          <CardTitle>{t('admin.loadingUsers')}</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.userManagement')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.name')}</TableHead>
              <TableHead>{t('admin.email')}</TableHead>
              <TableHead>{t('admin.status')}</TableHead>
              <TableHead>{t('admin.registration')}</TableHead>
              <TableHead>{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.full_name}
                  {user.isMaster && (
                    <Badge variant="secondary" className="ml-2 bg-purple-500 text-white">
                      {t('admin.master')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getRoleBadge(user.role)}
                    {user.role === 'trial' && user.trialExpiresAt && (
                      <span className="text-xs text-muted-foreground">
                        {t('admin.expires')}: {new Date(user.trialExpiresAt).toLocaleDateString('pt-BR')}
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
                        <SelectItem value="free">{t('admin.free')}</SelectItem>
                        <SelectItem value="premium">{t('admin.premium')}</SelectItem>
                        <SelectItem value="admin">{t('admin.admin_role')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {!user.isMaster && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={loading}
                        title={t('admin.deleteUserTitle')}
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
