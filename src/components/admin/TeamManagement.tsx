import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TeamInvite } from "./TeamInvite";

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
}

export function TeamManagement() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('new');
  const [newMember, setNewMember] = useState({
    email: "",
    role: "member",
  });

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
          profiles:user_id (email, full_name)
        `)
        .eq("organization_id", selectedOrg);

      if (error) throw error;

      const membersData = data?.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        email: m.profiles?.email || "N/A",
        full_name: m.profiles?.full_name || null,
      })) || [];

      setMembers(membersData);
    } catch (error: any) {
      toast.error("Erro ao carregar membros", { description: error.message });
    }
  };

  const handleInviteMember = async () => {
    if (!selectedOrg || !newMember.email) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      // Buscar usuário pelo email
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", newMember.email)
        .single();

      if (profileError || !profiles) {
        toast.error("Usuário não encontrado com este email");
        return;
      }

      // Adicionar membro
      const { error } = await supabase
        .from("organization_members")
        .insert({
          organization_id: selectedOrg,
          user_id: profiles.user_id,
          role: newMember.role,
          permissions: 
            newMember.role === "owner" || newMember.role === "admin"
              ? { view: true, create: true, edit: true, delete: true }
              : { view: true, create: false, edit: false, delete: false },
        });

      if (error) throw error;

      toast.success("Membro adicionado com sucesso!");
      setOpen(false);
      setNewMember({ email: "", role: "member" });
      fetchMembers();
    } catch (error: any) {
      toast.error("Erro ao adicionar membro", { description: error.message });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Deseja realmente remover este membro?")) return;

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

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({
          role: newRole,
          permissions:
            newRole === "owner" || newRole === "admin"
              ? { view: true, create: true, edit: true, delete: true }
              : { view: true, create: false, edit: false, delete: false },
        })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Permissão atualizada!");
      fetchMembers();
    } catch (error: any) {
      toast.error("Erro ao atualizar permissão", { description: error.message });
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-4">
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
            </DialogHeader>
            
            <Tabs value={inviteMode} onValueChange={(v) => setInviteMode(v as 'existing' | 'new')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new">Criar Novo Usuário</TabsTrigger>
                <TabsTrigger value="existing">Adicionar Existente</TabsTrigger>
              </TabsList>
              
              <TabsContent value="new">
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
              </TabsContent>
              
              <TabsContent value="existing">
                <div className="space-y-4 py-4">
                  <div>
                    <Label>E-mail do Membro</Label>
                    <Input
                      type="email"
                      placeholder="membro@exemplo.com"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      O membro deve ter uma conta criada no sistema
                    </p>
                  </div>
                  <div>
                    <Label>Permissão</Label>
                    <Select
                      value={newMember.role}
                      onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin (Pode gerenciar tudo)</SelectItem>
                        <SelectItem value="member">Membro (Pode criar/editar próprios dados)</SelectItem>
                        <SelectItem value="viewer">Visualizador (Apenas visualizar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleInviteMember} className="w-full">
                    Adicionar Membro
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

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
                  <TableHead>Permissão</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name || "Sem nome"}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {member.role === "owner" ? (
                        <Badge>Proprietário</Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleUpdateRole(member.id, value)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Membro</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
