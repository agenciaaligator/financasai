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

      console.log('[useOrganizationPermissions] Organizações encontradas:', data);

      // PRIORIZAR membership onde NÃO É owner (organizações de terceiros)
      // Se não houver, aí sim usar a organização onde é owner
      const nonOwnerMembership = data.find(m => m.role !== 'owner');
      const ownerMembership = data.find(m => m.role === 'owner');
      const selected = nonOwnerMembership ?? ownerMembership ?? data[0];

      console.log('[useOrganizationPermissions] Org ativa selecionada:', selected, '(role:', selected.role, ', prioridade: terceiros)');

      const raw = (selected.permissions as any) || {};
      const isOwnerRole = selected.role === 'owner';

      setPermissions({
        organization_id: selected.organization_id,
        role: selected.role,
        canViewOthers: isOwnerRole ? true : (raw.view_others ?? false),
        canEditOthers: isOwnerRole ? true : (raw.edit_others ?? false),
        canDeleteOthers: isOwnerRole ? true : (raw.delete_others ?? false),
        canViewReports: isOwnerRole ? true : (raw.view_reports ?? false),
        canManageMembers: isOwnerRole ? true : (raw.manage_members ?? false),
        loading: false,
      });
    }

    fetchPermissions();
  }, [user]);

  return permissions;
}
