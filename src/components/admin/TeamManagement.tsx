import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Users, MoreVertical, Edit, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TeamInvite } from "./TeamInvite";
import { MemberEditDialog } from "./MemberEditDialog";
import { PendingInvites } from "./PendingInvites";

interface Organization {
  id: string;
  name: string;
  owner_id: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string | null;
  permissions: any;
}

export function TeamManagement() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
      fetchMembers();
    }
  }, [selectedOrg]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user?.id);

      if (error) throw error;
      setOrganizations(data || []);
      if (data && data.length > 0) {
        setSelectedOrg(data[0].id);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar organizações", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!selectedOrg) return;

    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          id,
          user_id,
          role,
          permissions,
          profiles!organization_members_user_id_fkey (email, full_name)
        `)
        .eq("organization_id", selectedOrg);

      if (error) throw error;

      const membersData = data?.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        permissions: m.permissions,
        email: m.profiles?.email || "N/A",
        full_name: m.profiles?.full_name || null,
      })) || [];

      setMembers(membersData);

      // Verificar se o usuário atual é owner
      const currentUserMember = membersData.find(m => m.user_id === user?.id);
      setIsOwner(currentUserMember?.role === 'owner');
    } catch (error: any) {
      toast.error("Erro ao carregar membros", { description: error.message });
    }
  };

  const handleUpdateMember = async (memberId: string, updates: { role: string; permissions: any }) => {
    try {
      // Se alterando para admin, dar permissões completas
      const finalPermissions = updates.role === 'admin' 
        ? {
            view: true,
            create: true,
            edit: true,
            delete: true,
            view_own: true,
            view_others: true,
            edit_own: true,
            edit_others: true,
            delete_own: true,
            delete_others: true,
            view_reports: true,
            manage_members: true
          }
        : updates.permissions;

      const { error } = await supabase
        .from('organization_members')
        .update({
          role: updates.role,
          permissions: finalPermissions,
          updated_at: new Date().toISOString()
        })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Membro atualizado com sucesso!');
      fetchMembers();
    } catch (error: any) {
      toast.error('Erro ao atualizar membro', { description: error.message });
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Deseja realmente remover ${memberEmail} da equipe?`)) return;

    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Membro removido com sucesso!");
      fetchMembers();
    } catch (error: any) {
      toast.error("Erro ao remover membro", { description: error.message });
    }
  };


  if (loading) return <div>Carregando...</div>;

  const roleLabels: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Admin',
    member: 'Membro'
  };

  const roleVariants: Record<string, 'default' | 'secondary' | 'outline'> = {
    owner: 'default',
    admin: 'secondary',
    member: 'outline'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Gerenciar Equipe
          </h2>
          {selectedOrg && (
            <p className="text-sm text-muted-foreground mt-1">
              Organização: {organizations.find((o) => o.id === selectedOrg)?.name}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar à Equipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
            </DialogHeader>
            
            {selectedOrg && (
              <TeamInvite
                organizationId={selectedOrg}
                onSuccess={() => {
                  setOpen(false);
                  fetchMembers();
                }}
                onCancel={() => setOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Convites Pendentes */}
      {selectedOrg && <PendingInvites organizationId={selectedOrg} />}

      {/* Membros Ativos */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum membro na equipe. Adicione o primeiro!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name || "Sem nome"}
                      {member.user_id === user?.id && (
                        <Badge variant="outline" className="ml-2">Você</Badge>
                      )}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleVariants[member.role] || 'outline'}>
                        {roleLabels[member.role] || member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.role === "owner" || member.role === "admin" ? (
                        <span className="text-sm text-muted-foreground">✓ Acesso total</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {member.permissions?.view_others && '👁 Ver outros • '}
                          {member.permissions?.edit_others && '✏️ Editar outros • '}
                          {member.permissions?.delete_others && '🗑 Deletar outros • '}
                          {member.permissions?.view_reports && '📊 Relatórios'}
                          {!member.permissions?.view_others && !member.permissions?.edit_others && 
                           !member.permissions?.delete_others && !member.permissions?.view_reports && 
                           '🔒 Apenas próprio'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== "owner" && (isOwner || member.user_id === user?.id) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isOwner && member.user_id !== user?.id && (
                              <DropdownMenuItem onClick={() => setEditingMember(member)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {(isOwner || member.user_id === user?.id) && (
                              <DropdownMenuItem 
                                onClick={() => handleRemoveMember(member.id, member.email)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {member.user_id === user?.id ? 'Sair da Equipe' : 'Remover'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <MemberEditDialog
        member={editingMember}
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        onSave={handleUpdateMember}
        isOwner={isOwner}
      />
    </div>
  );
}
