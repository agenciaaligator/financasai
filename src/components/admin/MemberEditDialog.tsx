import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string | null;
  permissions: any;
}

interface MemberEditDialogProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberId: string, updates: { role: string; permissions: any }) => Promise<void>;
  isOwner: boolean;
}

export function MemberEditDialog({ member, isOpen, onClose, onSave, isOwner }: MemberEditDialogProps) {
  const [role, setRole] = useState(member?.role || 'member');
  const [permissions, setPermissions] = useState(member?.permissions || {});
  const [saving, setSaving] = useState(false);

  // Atualizar state quando member mudar
  useState(() => {
    if (member) {
      setRole(member.role);
      setPermissions(member.permissions || {});
    }
  });

  const handleSave = async () => {
    if (!member) return;
    
    setSaving(true);
    try {
      await onSave(member.id, { role, permissions });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  const roleDescriptions: Record<string, string> = {
    admin: '⭐ Pode gerenciar membros e visualizar tudo',
    member: '👤 Acesso básico com permissões personalizadas'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Membro</DialogTitle>
          <p className="text-sm text-muted-foreground">{member.full_name || member.email}</p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Role Selector */}
          <div className="space-y-2">
            <Label>Função</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isOwner && <SelectItem value="admin">Administrador</SelectItem>}
                <SelectItem value="member">Membro</SelectItem>
              </SelectContent>
            </Select>
            {roleDescriptions[role] && (
              <p className="text-xs text-muted-foreground">
                {roleDescriptions[role]}
              </p>
            )}
          </div>

          {/* Permissions (apenas se member) */}
          {role === 'member' && (
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-semibold">Permissões Detalhadas</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                  <div className="space-y-1">
                    <Label className="text-sm font-normal cursor-pointer">Ver transações de outros</Label>
                    <p className="text-xs text-muted-foreground">Pode visualizar dados de outros membros</p>
                  </div>
                  <Switch
                    checked={permissions.view_others || false}
                    onCheckedChange={(checked) => 
                      setPermissions(prev => ({ ...prev, view_others: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                  <div className="space-y-1">
                    <Label className="text-sm font-normal cursor-pointer">Editar transações de outros</Label>
                    <p className="text-xs text-muted-foreground">Pode modificar dados de outros membros</p>
                  </div>
                  <Switch
                    checked={permissions.edit_others || false}
                    onCheckedChange={(checked) => 
                      setPermissions(prev => ({ ...prev, edit_others: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                  <div className="space-y-1">
                    <Label className="text-sm font-normal cursor-pointer">Deletar transações de outros</Label>
                    <p className="text-xs text-muted-foreground">Pode excluir dados de outros membros</p>
                  </div>
                  <Switch
                    checked={permissions.delete_others || false}
                    onCheckedChange={(checked) => 
                      setPermissions(prev => ({ ...prev, delete_others: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between py-2 px-3 bg-muted rounded-md">
                  <div className="space-y-1">
                    <Label className="text-sm font-normal cursor-pointer">Ver relatórios gerais</Label>
                    <p className="text-xs text-muted-foreground">Acesso a relatórios consolidados da equipe</p>
                  </div>
                  <Switch
                    checked={permissions.view_reports || false}
                    onCheckedChange={(checked) => 
                      setPermissions(prev => ({ ...prev, view_reports: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {/* Admin permissions info */}
          {role === 'admin' && (
            <div className="bg-primary/10 border border-primary/20 rounded-md p-4 text-sm">
              <p className="font-semibold mb-2">Permissões de Administrador:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>✓ Ver e editar tudo</li>
                <li>✓ Gerenciar membros</li>
                <li>✓ Acessar relatórios</li>
                <li>✓ Adicionar/remover membros</li>
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
