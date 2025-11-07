import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Palette } from "lucide-react";
import { useFeatureLimits } from "@/hooks/useFeatureLimits";
import { UpgradeModal } from "./UpgradeModal";
import { categorySchema } from "@/lib/validations";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
}

interface CategoryManagerProps {
  categories: Category[];
  onRefresh: () => void;
  showForm: boolean;
  setShowForm: (show: boolean) => void;
}

export function CategoryManager({ categories, onRefresh, showForm, setShowForm }: CategoryManagerProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState("#3B82F6");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const { canCreateCategory, getCategoryProgress, refetchUsage } = useFeatureLimits();

  const colors = [
    "#EF4444", "#F59E0B", "#8B5CF6", "#10B981", "#EC4899",
    "#3B82F6", "#F97316", "#6B7280", "#059669", "#0D9488",
    "#0891B2", "#16A34A", "#DC2626", "#CA8A04", "#7C3AED"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !user) return;

    try {
      // Validar dados
      const validated = categorySchema.parse({
        name,
        type,
        color
      });

      // Verificar limite antes de criar
      const limitCheck = canCreateCategory();
      if (!limitCheck.allowed) {
        setUpgradeReason(limitCheck.reason || 'Upgrade necessário para criar mais categorias.');
        setShowUpgradeModal(true);
        toast({
          title: "Limite atingido",
          description: limitCheck.reason,
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('categories')
        .insert([{
          name: validated.name,
          type: validated.type,
          color: validated.color,
          user_id: user.id
        }]);

      if (error) throw error;

      toast({
        title: "Categoria criada!",
        description: `Categoria "${validated.name}" adicionada com sucesso.`
      });

      // Atualizar uso após criar
      await refetchUsage();

      setName("");
      setType('expense');
      setColor("#3B82F6");
      setShowForm(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Erro ao criar categoria",
        description: error.errors?.[0]?.message || error.message || "Erro de validação",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string, categoryName: string) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro ao excluir categoria",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Categoria excluída",
      description: `Categoria "${categoryName}" removida com sucesso.`
    });

    onRefresh();
  };

  const categoryProgress = getCategoryProgress();

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gerenciar Categorias</CardTitle>
        {categoryProgress && (
          <Badge variant={categoryProgress.isNearLimit ? "destructive" : "secondary"}>
            {categoryProgress.current}/{categoryProgress.limit} categorias
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {showForm && (
          <Card className="mb-6 bg-muted/30">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoryName">Nome da Categoria</Label>
                    <Input
                      id="categoryName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Alimentação, Salário..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoryType">Tipo</Label>
                    <Select value={type} onValueChange={(value: 'income' | 'expense') => setType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cor da Categoria</Label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((colorOption) => (
                      <button
                        key={colorOption}
                        type="button"
                        onClick={() => setColor(colorOption)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          color === colorOption ? 'border-foreground scale-110' : 'border-border'
                        }`}
                        style={{ backgroundColor: colorOption }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button type="submit" className="bg-gradient-primary hover:shadow-primary">
                    Criar Categoria
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold mb-3 text-success">Categorias de Receita</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories
                .filter(cat => cat.type === 'income')
                .map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm font-medium">{category.name}</span>
                    </div>
                    <DeleteConfirmationDialog
                      itemName={category.name}
                      itemType="categoria"
                      onConfirm={() => handleDelete(category.id, category.name)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </DeleteConfirmationDialog>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-3 text-destructive">Categorias de Despesa</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories
                .filter(cat => cat.type === 'expense')
                .map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm font-medium">{category.name}</span>
                    </div>
                    <DeleteConfirmationDialog
                      itemName={category.name}
                      itemType="categoria"
                      onConfirm={() => handleDelete(category.id, category.name)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </DeleteConfirmationDialog>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
      
      <UpgradeModal 
        open={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
      />
    </Card>
  );
}