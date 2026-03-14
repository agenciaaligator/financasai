import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Sparkles } from "lucide-react";
import { Transaction } from '@/hooks/useTransactions';
import { useAuth } from "@/hooks/useAuth";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { ChatSkeleton } from "@/components/ui/chat-skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategoryPatterns } from "@/hooks/useCategoryPatterns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
  currentPage?: number;
  totalPages?: number;
  itemsPerPage?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onRefresh?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  totalTransactionsCount?: number;
  isLoading?: boolean;
}

export function TransactionList({ 
  transactions, 
  onDelete, 
  onEdit,
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onRefresh,
  hasActiveFilters,
  onClearFilters,
  totalTransactionsCount,
  isLoading = false
}: TransactionListProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { categories } = useTransactions();
  const { learnPattern } = useCategoryPatterns();
  const { toast } = useToast();
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const formatFriendlyDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const transactionDate = new Date(year, month - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    if (transactionDate.getTime() === today.getTime()) {
      return t('filters.today', 'Hoje');
    }
    if (transactionDate.getTime() === yesterday.getTime()) {
      return t('transactionList.yesterday', 'Ontem');
    }
    if (transactionDate.getTime() === twoDaysAgo.getTime()) {
      return t('categories.daysAgo', '{{count}} dias atrás', { count: 2 });
    }
    if (transactionDate.getTime() === threeDaysAgo.getTime()) {
      return t('categories.daysAgo', '{{count}} dias atrás', { count: 3 });
    }
    if (transactionDate >= oneWeekAgo) {
      const daysDiff = Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
      return t('categories.daysAgo', '{{count}} dias atrás', { count: daysDiff });
    }

    return new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(transactionDate);
  };

  const getCategoryEmoji = (categoryName?: string) => {
    if (!categoryName) return '💬';
    const name = categoryName.toLowerCase();
    if (name.includes('alimentação') || name.includes('comida') || name.includes('mercado')) return '🍽️';
    if (name.includes('transporte') || name.includes('uber') || name.includes('gasolina')) return '🚗';
    if (name.includes('saúde') || name.includes('médico') || name.includes('farmácia')) return '💊';
    if (name.includes('lazer') || name.includes('entretenimento') || name.includes('cinema')) return '🎮';
    if (name.includes('casa') || name.includes('moradia') || name.includes('aluguel')) return '🏠';
    if (name.includes('educação') || name.includes('curso') || name.includes('livro')) return '📚';
    if (name.includes('trabalho') || name.includes('projeto') || name.includes('freelance')) return '💼';
    return '💬';
  };

  const getCategoryGradient = (categoryName?: string) => {
    if (!categoryName) return 'bg-gradient-to-br from-gray-400 to-gray-500';
    const name = categoryName.toLowerCase();
    if (name.includes('alimentação') || name.includes('comida') || name.includes('mercado')) return 'bg-gradient-to-br from-red-400 to-red-600';
    if (name.includes('transporte') || name.includes('uber') || name.includes('gasolina')) return 'bg-gradient-to-br from-blue-400 to-green-500';
    if (name.includes('casa') || name.includes('moradia') || name.includes('aluguel')) return 'bg-gradient-to-br from-blue-400 to-green-500';
    if (name.includes('trabalho') || name.includes('projeto') || name.includes('freelance')) return 'bg-gradient-to-br from-purple-400 to-purple-600';
    return 'bg-gradient-to-br from-gray-400 to-gray-500';
  };

  const getTransactionSource = (transaction: Transaction) => {
    return transaction.source === 'whatsapp' ? 'WhatsApp' : 'Manual';
  };

  const handleQuickCategoryChange = async (transaction: Transaction, newCategoryId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category_id: newCategoryId })
        .eq('id', transaction.id);

      if (error) throw error;

      // Learn pattern from this correction
      const learned = await learnPattern(transaction.title, newCategoryId);
      
      const selectedCategory = categories.find(c => c.id === newCategoryId);
      
      toast({
        title: learned 
          ? t('categories.patternLearned', '✅ Padrão aprendido!')
          : t('categories.categoryChanged', 'Categoria atualizada'),
        description: learned
          ? t('categories.patternLearnedDesc', 'Próximas transações similares usarão "{{category}}"', { category: selectedCategory?.name || '' })
          : undefined
      });

      setEditingCategoryId(null);
      onRefresh?.();
    } catch (err) {
      toast({
        title: t('common.error', 'Erro'),
        description: t('categories.changeError', 'Não foi possível alterar a categoria'),
        variant: "destructive"
      });
    }
  };

  const handlePageChange = (page: number) => {
    if (onPageChange && page >= 1 && totalPages && page <= totalPages) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return <ChatSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        {hasActiveFilters ? (
          <div className="space-y-3">
            <div className="text-6xl">💬</div>
            <p className="text-muted-foreground">{t('transactionList.searchNoResults', 'Não encontramos nada. Tente outros termos.')}</p>
            {onClearFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                {t('transactionList.clearAllFilters', 'Limpar todos os filtros')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-6xl">💬</div>
            <p className="text-muted-foreground font-medium">
              {t('transactionList.noTransactionsYet', 'Nenhuma conversa ainda...')}
            </p>
            <p className="text-sm text-muted-foreground/80">
              {t('transactionList.noTransactions', 'Que tal enviar "gastei 50 no mercado" pelo WhatsApp?')}
            </p>
          </div>
        )}
      </div>
    );
  }

  const showPagination = totalPages && totalPages > 1;
  const startItem = currentPage && itemsPerPage ? (currentPage - 1) * itemsPerPage + 1 : 1;
  const endItem = currentPage && itemsPerPage && totalItems 
    ? Math.min(currentPage * itemsPerPage, totalItems) 
    : transactions.length;

  return (
    <div className="space-y-4">
      {showPagination && totalItems && (
        <div className="text-sm text-muted-foreground text-center sm:text-left">
          {t('transactionList.showing', 'Mostrando {{start}}-{{end}} de {{total}} transações', { start: startItem, end: endItem, total: totalItems })}
        </div>
      )}
      
      <div className="space-y-3">
      {transactions.map((transaction) => (
        <Card key={transaction.id} className={`rounded-[16px] border-0 hover:translate-x-1 hover:bg-[hsl(var(--primary)/0.02)] transition-all duration-300 shadow-sm`}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                <div className={`w-12 h-12 rounded-full flex-shrink-0 ${getCategoryGradient(transaction.categories?.name)} flex items-center justify-center shadow-sm`}>
                  <span className="text-xl">{getCategoryEmoji(transaction.categories?.name)}</span>
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <p className="font-medium truncate">{transaction.title}</p>
                    <div className="flex gap-2">
                      {/* Quick-edit category badge */}
                      <Popover 
                        open={editingCategoryId === transaction.id} 
                        onOpenChange={(open) => setEditingCategoryId(open ? transaction.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className="text-xs w-fit cursor-pointer hover:bg-accent transition-colors"
                            title={t('categories.clickToChange', 'Clique para alterar a categoria')}
                          >
                            {transaction.categories?.name || t('categories.uncategorized', 'Sem categoria')}
                          </Badge>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                              {t('categories.selectCategory', 'Selecionar categoria')}
                            </p>
                            {categories
                              .filter(cat => cat.type === transaction.type)
                              .map(cat => (
                                <button
                                  key={cat.id}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
                                  onClick={() => handleQuickCategoryChange(transaction, cat.id)}
                                >
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: cat.color }} 
                                  />
                                  <span>{cat.name}</span>
                                  {transaction.category_id === cat.id && (
                                    <span className="ml-auto text-primary">✓</span>
                                  )}
                                </button>
                              ))
                            }
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Badge variant="secondary" className="text-xs w-fit">
                        {getTransactionSource(transaction)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatFriendlyDate(transaction.date)}
                    {transaction.description && (
                      <span className="block sm:inline">
                        <span className="hidden sm:inline"> • </span>
                        <span className="break-words">{transaction.description}</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end space-x-2 flex-shrink-0">
                <div className="text-left sm:text-right">
                  <p className={`font-bold text-base sm:text-lg ${
                    transaction.type === 'income' ? 'text-success' : 'text-destructive'
                  }`}>
                    {transaction.type === 'income' ? '↗ +' : '↘ -'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex space-x-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(transaction)}
                      className="text-primary hover:text-primary h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <DeleteConfirmationDialog
                      itemName={transaction.title}
                      itemType="transaction"
                      onConfirm={() => onDelete(transaction.id)}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </DeleteConfirmationDialog>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      </div>

      {showPagination && currentPage && totalPages && (
        <Pagination className="mt-6">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => handlePageChange(currentPage - 1)}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return (
                  <PaginationItem key={page}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              return null;
            })}

            <PaginationItem>
              <PaginationNext 
                onClick={() => handlePageChange(currentPage + 1)}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
