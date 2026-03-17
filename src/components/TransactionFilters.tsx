import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export interface TransactionFiltersState {
  period: 'all' | 'today' | 'week' | 'month' | 'last_month';
  type: 'all' | 'income' | 'expense';
  searchText: string;
}

interface TransactionFiltersProps {
  filters: TransactionFiltersState;
  onFiltersChange: (filters: TransactionFiltersState) => void;
  categories?: Array<{ id: string; name: string; type: string }>;
}

export function TransactionFilters({ 
  filters, 
  onFiltersChange, 
}: TransactionFiltersProps) {
  const { t } = useTranslation();

  const activeFiltersCount = [
    filters.period !== 'all',
    filters.type !== 'all',
    filters.searchText.trim() !== '',
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      period: 'all',
      type: 'all',
      searchText: '',
    });
  };

  return (
    <Card className="rounded-[20px] bg-gradient-card shadow-card border-0 mb-4">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">🔍 {t('filters.title', 'Filtrar transações')}</h3>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2 rounded-full">
                {activeFiltersCount} {activeFiltersCount === 1 ? t('filters.activeFilter', 'filtro ativo') : t('filters.activeFilters', 'filtros ativos')}
              </Badge>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-[25px]">
              <X className="h-4 w-4 mr-2" />
              {t('filters.clearFilters', 'Limpar filtros')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Período */}
          <div className="space-y-2">
            <Label>{t('filters.period', 'Período')}</Label>
            <Tabs value={filters.period} onValueChange={(value) => onFiltersChange({ ...filters, period: value as TransactionFiltersState['period'] })} className="w-full">
              <TabsList className="flex overflow-x-auto h-auto rounded-[25px] p-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
                <TabsTrigger value="all" className="text-xs rounded-[20px] flex-shrink-0">{t('filters.all', 'Todos')}</TabsTrigger>
                <TabsTrigger value="today" className="text-xs rounded-[20px] flex-shrink-0">{t('filters.today', 'Hoje')}</TabsTrigger>
                <TabsTrigger value="week" className="text-xs rounded-[20px] flex-shrink-0">{t('filters.week', 'Semana')}</TabsTrigger>
                <TabsTrigger value="month" className="text-xs rounded-[20px] flex-shrink-0">{t('filters.month', 'Mês')}</TabsTrigger>
                <TabsTrigger value="last_month" className="text-xs rounded-[20px] flex-shrink-0">{t('filters.lastMonth', 'Último mês')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>{t('filters.type', 'Tipo de transação')}</Label>
            <Select value={filters.type} onValueChange={(value) => onFiltersChange({ ...filters, type: value as TransactionFiltersState['type'] })}>
              <SelectTrigger className="rounded-[16px]">
                <SelectValue placeholder={t('filters.allTransactions', 'Todas as conversas')} />
              </SelectTrigger>
              <SelectContent className="rounded-[16px]">
                <SelectItem value="all">{t('filters.allConversations', 'Todas as conversas')}</SelectItem>
                <SelectItem value="income">{t('filters.onlyIncome', 'Só entradas')}</SelectItem>
                <SelectItem value="expense">{t('filters.onlyExpenses', 'Só saídas')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Busca por texto */}
          <div className="space-y-2">
            <Label>{t('filters.search', 'Buscar na conversa')}</Label>
            <Input
              placeholder={t('filters.searchPlaceholder', 'Digite para buscar...')}
              value={filters.searchText}
              onChange={(e) => onFiltersChange({ ...filters, searchText: e.target.value })}
              className="rounded-[16px]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
