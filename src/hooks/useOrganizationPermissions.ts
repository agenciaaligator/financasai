import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OrganizationPermissions {
  organization_id: string | null;
  role: string | null;
  canViewOthers: boolean;
  canEditOthers: boolean;
  canDeleteOthers: boolean;
  canViewReports: boolean;
  canManageMembers: boolean;
  loading: boolean;
}

export function useOrganizationPermissions(): OrganizationPermissions {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<OrganizationPermissions>({
    organization_id: null,
    role: null,
    canViewOthers: false,
    canEditOthers: false,
    canDeleteOthers: false,
    canViewReports: false,
    canManageMembers: false,
    loading: true,
  });

  useEffect(() => {
    async function fetchPermissions() {
      if (!user) {
        setPermissions({
          organization_id: null,
          role: null,
          canViewOthers: false,
          canEditOthers: false,
          canDeleteOthers: false,
          canViewReports: false,
          canManageMembers: false,
          loading: false,
        });
        return;
      }

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, role, permissions')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        setPermissions({
          organization_id: null,
          role: null,
          canViewOthers: false,
          canEditOthers: false,
          canDeleteOthers: false,
          canViewReports: false,
          canManageMembers: false,
          loading: false,
        });
        return;
      }

      // Preferir organizações onde o usuário não é owner (é membro)
      const membership = data.find(m => m.role !== 'owner') || data[0];

      const perms = membership.permissions as any;
      setPermissions({
        organization_id: membership.organization_id,
        role: membership.role,
        canViewOthers: perms?.view_others ?? false,
        canEditOthers: perms?.edit_others ?? false,
        canDeleteOthers: perms?.delete_others ?? false,
        canViewReports: perms?.view_reports ?? false,
        canManageMembers: perms?.manage_members ?? false,
        loading: false,
      });
    }

    fetchPermissions();
  }, [user]);

  return permissions;
}
