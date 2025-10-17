import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TeamInviteProps {
  organizationId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TeamInvite({ organizationId, onSuccess, onCancel }: TeamInviteProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "member"
  });
  const [loading, setLoading] = useState(false);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
    toast.success("Senha gerada!", { description: password });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      // 1. Criar usuário via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          toast.error("Email já cadastrado", {
            description: "Este email já possui uma conta. Use 'Adicionar Membro Existente'."
          });
        } else {
          toast.error("Erro ao criar usuário", { description: authError.message });
        }
        return;
      }

      if (!authData.user) {
        toast.error("Erro ao criar usuário");
        return;
      }

      // 2. Atualizar telefone no perfil (se fornecido)
      if (formData.phone) {
        await supabase
          .from('profiles')
          .update({ phone_number: formData.phone })
          .eq('user_id', authData.user.id);
      }

      // 3. Adicionar à organização
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: authData.user.id,
          role: formData.role,
          permissions: 
            formData.role === "admin"
              ? { view: true, create: true, edit: true, delete: true }
              : formData.role === "member"
              ? { view: true, create: true, edit: false, delete: false }
              : { view: true, create: false, edit: false, delete: false }
        });

      if (memberError) {
        toast.error("Erro ao adicionar à equipe", { description: memberError.message });
        return;
      }

      toast.success("Usuário criado e adicionado à equipe!", {
        description: `${formData.fullName} receberá um email de confirmação em ${formData.email}`
      });

      // Limpar formulário e fechar
      setFormData({ fullName: "", email: "", phone: "", password: "", role: "member" });
      onSuccess();

    } catch (error: any) {
      toast.error("Erro ao criar usuário", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div>
        <Label>Nome Completo *</Label>
        <Input
          placeholder="Ex: Maria Silva"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          required
        />
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
        <Label>Telefone (WhatsApp)</Label>
        <Input
          type="tel"
          placeholder="+55 11 99999-9999"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
      </div>

      <div>
        <Label>Senha *</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Mínimo 6 caracteres"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <Button type="button" variant="outline" onClick={generateRandomPassword}>
            Gerar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          💡 Dica: Clique em "Gerar" para criar uma senha segura
        </p>
      </div>

      <div>
        <Label>Permissão</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData({ ...formData, role: value })}
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

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Criar e Adicionar
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
        <p className="text-blue-900">
          📧 O novo membro receberá um email para confirmar a conta.
          <br />
          💾 Anote a senha gerada para enviar ao membro por outro canal (WhatsApp, SMS, etc).
        </p>
      </div>
    </form>
  );
}
