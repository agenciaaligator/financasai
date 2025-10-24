import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
  const { user } = useAuth();
  const [role, setRole] = useState(member?.role || 'member');
  const [permissions, setPermissions] = useState(member?.permissions || {});
  const [saving, setSaving] = useState(false);

  // Atualizar state quando member mudar
  useEffect(() => {
    if (member) {
      setRole(member.role);
      setPermissions(member.permissions || {});
    }
  }, [member]);

  const isEditingSelf = member?.user_id === user?.id;
  const isMemberOwner = member?.role === 'owner';

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
            <Select value={role} onValueChange={setRole} disabled={isMemberOwner}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isOwner && <SelectItem value="admin">Administrador</SelectItem>}
                <SelectItem value="member">Membro</SelectItem>
              </SelectContent>
            </Select>
            {isMemberOwner && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Proprietários não podem ter sua função alterada
              </p>
            )}
            
            {/* Descrição expandida do role selecionado */}
            {role && (
              <div className={`border rounded-lg p-4 mt-3 ${
                role === 'admin' 
                  ? 'bg-primary/5 border-primary/20' 
                  : role === 'owner'
                  ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                  : 'bg-muted'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {role === 'owner' && '👑'}
                    {role === 'admin' && '⭐'}
                    {role === 'member' && '👤'}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">
                      {role === 'owner' && 'Proprietário'}
                      {role === 'admin' && 'Administrador'}
                      {role === 'member' && 'Membro'}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {role === 'owner' && 'Controle total da organização'}
                      {role === 'admin' && 'Acesso completo para gerenciar a organização'}
                      {role === 'member' && 'Acesso básico com permissões personalizadas'}
                    </p>
                    
                    <ul className="text-xs space-y-1.5 text-muted-foreground">
                      {role === 'owner' && (
                        <>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Controle absoluto sobre a organização
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Promover membros a administradores
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Gerenciar assinaturas e pagamentos
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Adicionar e remover qualquer membro
                          </li>
                        </>
                      )}
                      
                      {role === 'admin' && (
                        <>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Ver, editar e deletar todos os dados
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Adicionar e remover membros (exceto proprietário)
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Editar permissões de outros membros
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Acessar relatórios completos
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-red-600 dark:text-red-400">✗</span>
                            Não pode remover o proprietário
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-red-600 dark:text-red-400">✗</span>
                            Não pode promover outros a administrador
                          </li>
                        </>
                      )}
                      
                      {role === 'member' && (
                        <>
                          <li className="flex items-center gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            Gerenciar seus próprios dados
                          </li>
                          <li className="flex items-center gap-2 font-semibold">
                            <span className="text-blue-600 dark:text-blue-400">⚙️</span>
                            Permissões configuráveis abaixo:
                          </li>
                          <li className="pl-6 text-muted-foreground/80">• Ver dados de outros membros</li>
                          <li className="pl-6 text-muted-foreground/80">• Editar dados de outros membros</li>
                          <li className="pl-6 text-muted-foreground/80">• Deletar dados de outros membros</li>
                          <li className="pl-6 text-muted-foreground/80">• Acessar relatórios gerais</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
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
