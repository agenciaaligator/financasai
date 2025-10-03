import { useState } from "react";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface TransactionFiltersState {
  period: 'all' | 'today' | 'week' | 'month' | '30days' | '90days' | 'year' | 'custom';
  customDateRange: { start: Date | null; end: Date | null };
  type: 'all' | 'income' | 'expense';
  categories: string[];
  source: 'all' | 'manual' | 'whatsapp';
  searchText: string;
}

interface TransactionFiltersProps {
  filters: TransactionFiltersState;
  onFiltersChange: (filters: TransactionFiltersState) => void;
  categories: Array<{ id: string; name: string; type: string }>;
}

export function TransactionFilters({ 
  filters, 
  onFiltersChange, 
  categories 
}: TransactionFiltersProps) {
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);

  const activeFiltersCount = [
    filters.period !== 'all',
    filters.type !== 'all',
    filters.categories.length > 0,
    filters.source !== 'all',
    filters.searchText.trim() !== ''
  ].filter(Boolean).length;

  const handlePeriodChange = (period: string) => {
    const newFilters = { ...filters, period: period as TransactionFiltersState['period'] };
    if (period !== 'custom') {
      newFilters.customDateRange = { start: null, end: null };
      setShowCustomDate(false);
    } else {
      setShowCustomDate(true);
    }
    onFiltersChange(newFilters);
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(id => id !== categoryId)
      : [...filters.categories, categoryId];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const clearFilters = () => {
    onFiltersChange({
      period: 'all',
      customDateRange: { start: null, end: null },
      type: 'all',
      categories: [],
      source: 'all',
      searchText: ''
    });
    setShowCustomDate(false);
  };

  return (
    <Card className="bg-gradient-card shadow-card border-0 mb-4">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold">Filtros</h3>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
              </Badge>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Tabs value={filters.period} onValueChange={handlePeriodChange} className="w-full">
              <TabsList className="grid grid-cols-4 h-auto">
                <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
                <TabsTrigger value="today" className="text-xs">Hoje</TabsTrigger>
                <TabsTrigger value="week" className="text-xs">Semana</TabsTrigger>
                <TabsTrigger value="month" className="text-xs">Mês</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={filters.period} onValueChange={handlePeriodChange} className="w-full">
              <TabsList className="grid grid-cols-4 h-auto">
                <TabsTrigger value="30days" className="text-xs">30d</TabsTrigger>
                <TabsTrigger value="90days" className="text-xs">90d</TabsTrigger>
                <TabsTrigger value="year" className="text-xs">Ano</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={filters.type} onValueChange={(value) => onFiltersChange({ ...filters, type: value as TransactionFiltersState['type'] })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as transações</SelectItem>
                <SelectItem value="income">Apenas Receitas</SelectItem>
                <SelectItem value="expense">Apenas Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fonte */}
          <div className="space-y-2">
            <Label>Fonte</Label>
            <Select value={filters.source} onValueChange={(value) => onFiltersChange({ ...filters, source: value as TransactionFiltersState['source'] })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categorias */}
          <div className="space-y-2">
            <Label>Categorias</Label>
            <Popover open={categorySearchOpen} onOpenChange={setCategorySearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {filters.categories.length === 0 
                    ? "Todas as categorias" 
                    : `${filters.categories.length} selecionada${filters.categories.length > 1 ? 's' : ''}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar categoria..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      {categories.map((category) => (
                        <CommandItem
                          key={category.id}
                          onSelect={() => handleCategoryToggle(category.id)}
                        >
                          <Checkbox
                            checked={filters.categories.includes(category.id)}
                            className="mr-2"
                          />
                          <span>{category.name}</span>
                          <Badge 
                            variant="outline" 
                            className="ml-auto text-xs"
                          >
                            {category.type === 'income' ? 'Receita' : 'Despesa'}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Busca por texto */}
          <div className="space-y-2 md:col-span-2 lg:col-span-2">
            <Label>Buscar</Label>
            <Input
              placeholder="Buscar por título ou descrição..."
              value={filters.searchText}
              onChange={(e) => onFiltersChange({ ...filters, searchText: e.target.value })}
            />
          </div>
        </div>

        {/* Custom Date Range */}
        {showCustomDate && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.customDateRange.start && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.customDateRange.start 
                      ? format(filters.customDateRange.start, "PPP", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.customDateRange.start || undefined}
                    onSelect={(date) => 
                      onFiltersChange({ 
                        ...filters, 
                        customDateRange: { ...filters.customDateRange, start: date || null } 
                      })
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.customDateRange.end && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.customDateRange.end 
                      ? format(filters.customDateRange.end, "PPP", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.customDateRange.end || undefined}
                    onSelect={(date) => 
                      onFiltersChange({ 
                        ...filters, 
                        customDateRange: { ...filters.customDateRange, end: date || null } 
                      })
                    }
                    disabled={(date) => 
                      filters.customDateRange.start ? date < filters.customDateRange.start : false
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
