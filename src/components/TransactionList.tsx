import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";
import { Transaction } from '@/hooks/useTransactions';
import { useAuth } from "@/hooks/useAuth";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { useTranslation } from "react-i18next";
import { ChatSkeleton } from "@/components/ui/chat-skeleton";
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
  totalTransactionsCount
}: TransactionListProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

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
      return '2 dias atrás';
    }
    if (transactionDate.getTime() === threeDaysAgo.getTime()) {
      return '3 dias atrás';
    }
    if (transactionDate >= oneWeekAgo) {
      const daysDiff = Math.floor((today.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
      return `${daysDiff} dias atrás`;
    }

    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${day} de ${months[month - 1]}`;
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

  const handlePageChange = (page: number) => {
    if (onPageChange && page >= 1 && totalPages && page <= totalPages) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
              Nenhuma conversa ainda...
            </p>
            <p className="text-sm text-muted-foreground/80">
              Que tal enviar "gastei 50 no mercado" pelo WhatsApp?
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
                      {transaction.categories && (
                        <Badge variant="outline" className="text-xs w-fit">
                          {transaction.categories.name}
                        </Badge>
                      )}
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
                      itemType="transação"
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
