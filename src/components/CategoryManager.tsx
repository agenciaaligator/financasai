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

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
}

interface CategoryManagerProps {
  categories: Category[];
  onRefresh: () => void;
}

export function CategoryManager({ categories, onRefresh }: CategoryManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState("#3B82F6");
  const { user } = useAuth();
  const { toast } = useToast();

  const colors = [
    "#EF4444", "#F59E0B", "#8B5CF6", "#10B981", "#EC4899",
    "#3B82F6", "#F97316", "#6B7280", "#059669", "#0D9488",
    "#0891B2", "#16A34A", "#DC2626", "#CA8A04", "#7C3AED"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !user) return;

    const { error } = await supabase
      .from('categories')
      .insert([{
        name: name.trim(),
        type,
        color,
        user_id: user.id
      }]);

    if (error) {
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Categoria criada!",
      description: `Categoria "${name}" adicionada com sucesso.`
    });

    setName("");
    setType('expense');
    setColor("#3B82F6");
    setShowForm(false);
    onRefresh();
  };

  const handleDelete = async (id: string, categoryName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${categoryName}"?`)) {
      return;
    }

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

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gerenciar Categorias</CardTitle>
          <Button 
            onClick={() => setShowForm(!showForm)}
            size="sm"
            className="bg-gradient-primary hover:shadow-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        </div>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category.id, category.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category.id, category.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}