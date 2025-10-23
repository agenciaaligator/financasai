import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TeamInviteProps {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TeamInvite({ organizationId, onSuccess, onCancel }: TeamInviteProps) {
  const { user } = useAuth();
  const [inviteMode, setInviteMode] = useState<'token' | 'existing'>('token');
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "member",
    canViewOthers: false,
    canEditOthers: false,
    canDeleteOthers: false,
    canViewReports: false
  });
  const [loading, setLoading] = useState(false);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error("Preencha o email");
      return;
    }

    setLoading(true);

    try {
      // Criar convite
      const { data: invitation, error: inviteError } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: organizationId,
          invited_by: user?.id,
          email: formData.email,
          role: formData.role,
          permissions: {
            view: true,
            create: true,
            edit: true,
            delete: true,
            view_own: true,
            view_others: formData.canViewOthers,
            edit_own: true,
            edit_others: formData.canEditOthers,
            delete_own: true,
            delete_others: formData.canDeleteOthers,
            view_reports: formData.canViewReports,
            manage_members: false
          }
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Enviar email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-team-invitation', {
        body: { invitationId: invitation.id }
      });

      if (emailError) {
        console.error('Erro ao enviar email:', emailError);
        toast.success("Convite criado!", {
          description: "Mas houve um problema ao enviar o email. Copie o link manualmente."
        });
      } else {
        toast.success("Convite enviado!", {
          description: `Um email foi enviado para ${formData.email}`
        });
      }

      // Limpar e fechar
      setFormData({ 
        fullName: "", 
        email: "", 
        phone: "", 
        role: "member", 
        canViewOthers: false,
        canEditOthers: false,
        canDeleteOthers: false,
        canViewReports: false
      });
      onSuccess();

    } catch (error: any) {
      toast.error("Erro ao criar convite", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error("Preencha o email");
      return;
    }

    setLoading(true);

    try {
      // Buscar usuário existente
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('email', formData.email)
        .single();

      if (profileError || !profile) {
        toast.error("Usuário não encontrado", {
          description: "Não existe conta com este email. Use 'Enviar Convite' para criar."
        });
        return;
      }

      // Adicionar diretamente como membro
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: profile.user_id,
          role: formData.role,
          permissions: {
            view: true,
            create: true,
            edit: true,
            delete: true,
            view_own: true,
            view_others: formData.canViewOthers,
            edit_own: true,
            edit_others: formData.canEditOthers,
            delete_own: true,
            delete_others: formData.canDeleteOthers,
            view_reports: formData.canViewReports,
            manage_members: false
          }
        });

      if (memberError) {
        if (memberError.code === '23505') {
          toast.error("Usuário já é membro desta organização");
        } else {
          toast.error("Erro ao adicionar membro", { description: memberError.message });
        }
        return;
      }

      toast.success("Membro adicionado com sucesso!", {
        description: `${profile.full_name || profile.email} foi adicionado à equipe`
      });

      // Limpar e fechar
      setFormData({ 
        fullName: "", 
        email: "", 
        phone: "", 
        role: "member", 
        canViewOthers: false,
        canEditOthers: false,
        canDeleteOthers: false,
        canViewReports: false
      });
      onSuccess();

    } catch (error: any) {
      toast.error("Erro ao adicionar membro", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tabs value={inviteMode} onValueChange={(v) => setInviteMode(v as 'token' | 'existing')} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="token" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Enviar Convite
        </TabsTrigger>
        <TabsTrigger value="existing" className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Adicionar Existente
        </TabsTrigger>
      </TabsList>

      <TabsContent value="token" className="space-y-4 mt-4">
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
            <p className="text-blue-900">
              📧 Um email com link de convite será enviado para o email informado.
              O convidado poderá criar conta ou fazer login para aceitar.
            </p>
          </div>

          <div>
            <Label>E-mail *</Label>
            <Input
              type="email"
              placeholder="maria@exemplo.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Função</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.role === 'admin' ? '⭐ Acesso total e pode gerenciar membros' : '👤 Acesso básico com permissões personalizadas'}
            </p>
          </div>

          {formData.role === 'member' && (
            <div className="space-y-3 border-t pt-3">
              <Label className="text-sm font-semibold">Permissões</Label>
              
              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal cursor-pointer">Ver dados de outros</Label>
                <Switch
                  checked={formData.canViewOthers}
                  onCheckedChange={(checked) => setFormData({ ...formData, canViewOthers: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal cursor-pointer">Editar dados de outros</Label>
                <Switch
                  checked={formData.canEditOthers}
                  onCheckedChange={(checked) => setFormData({ ...formData, canEditOthers: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal cursor-pointer">Deletar dados de outros</Label>
                <Switch
                  checked={formData.canDeleteOthers}
                  onCheckedChange={(checked) => setFormData({ ...formData, canDeleteOthers: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal cursor-pointer">Ver relatórios gerais</Label>
                <Switch
                  checked={formData.canViewReports}
                  onCheckedChange={(checked) => setFormData({ ...formData, canViewReports: checked })}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar Convite
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="existing" className="space-y-4 mt-4">
        <form onSubmit={handleAddExisting} className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
            <p className="text-green-900">
              ✅ Adicione usuários que já possuem conta no sistema.
              Eles terão acesso imediato à organização.
            </p>
          </div>

          <div>
            <Label>E-mail do Membro Existente *</Label>
            <Input
              type="email"
              placeholder="maria@exemplo.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Buscaremos este email no sistema
            </p>
          </div>

          <div>
            <Label>Função</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="member">Membro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'member' && (
            <div className="space-y-3 border-t pt-3">
              <Label className="text-sm font-semibold">Permissões</Label>
              
              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal">Ver dados de outros</Label>
                <Switch
                  checked={formData.canViewOthers}
                  onCheckedChange={(checked) => setFormData({ ...formData, canViewOthers: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal">Editar dados de outros</Label>
                <Switch
                  checked={formData.canEditOthers}
                  onCheckedChange={(checked) => setFormData({ ...formData, canEditOthers: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal">Deletar dados de outros</Label>
                <Switch
                  checked={formData.canDeleteOthers}
                  onCheckedChange={(checked) => setFormData({ ...formData, canDeleteOthers: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                <Label className="text-sm font-normal">Ver relatórios gerais</Label>
                <Switch
                  checked={formData.canViewReports}
                  onCheckedChange={(checked) => setFormData({ ...formData, canViewReports: checked })}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar Membro
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
