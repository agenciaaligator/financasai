import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Trash2, Edit } from "lucide-react";
import { Transaction } from '@/hooks/useTransactions';
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";
import { useAuth } from "@/hooks/useAuth";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
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
  const { canEditOthers, canDeleteOthers } = useOrganizationPermissions();
  const { user } = useAuth();

  const formatDate = (dateString: string) => {
    // Parse date manually to avoid timezone issues
    // dateString is in format YYYY-MM-DD
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handlePageChange = (page: number) => {
    if (onPageChange && page >= 1 && totalPages && page <= totalPages) {
      onPageChange(page);
      // Scroll to top suavemente
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">Nenhuma transação encontrada</p>
        
        {hasActiveFilters && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm">
            <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
              ⚠️ Você tem filtros ativos
            </p>
            <p className="text-yellow-700 dark:text-yellow-300 mb-3">
              As transações podem estar ocultas pelos filtros aplicados.
            </p>
            {onClearFilters && (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Limpar todos os filtros
              </Button>
            )}
          </div>
        )}

        {!hasActiveFilters && totalTransactionsCount && totalTransactionsCount > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
            <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
              💡 Existem {totalTransactionsCount} transações no total
            </p>
            <p className="text-blue-700 dark:text-blue-300 mb-3">
              Tente recarregar para ver as transações mais recentes.
            </p>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Recarregar transações
              </Button>
            )}
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
          Mostrando {startItem}-{endItem} de {totalItems} transações
        </div>
      )}
      
      <div className="space-y-3">
      {transactions.map((transaction) => (
        <Card key={transaction.id} className={`border-l-4 hover:shadow-soft transition-shadow ${transaction.type === 'income' ? 'border-l-success/40' : 'border-l-destructive/40'}`}>
          <CardContent className="pt-4">
            {/* Layout mobile-first responsivo */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                <div className={`p-2 rounded-full flex-shrink-0 ${
                  transaction.type === 'income' 
                    ? 'bg-success/10 text-success' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {transaction.type === 'income' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <p className="font-medium truncate">{transaction.title}</p>
                    <div className="flex flex-wrap gap-1">
                      {transaction.categories && (
                        <Badge variant="outline" className="text-xs">
                          {transaction.categories.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs opacity-60">
                        {transaction.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
                      </Badge>
                      {transaction.profiles && (
                        <Badge 
                          variant="outline" 
                          className="text-xs opacity-60"
                        >
                          {transaction.profiles.full_name || transaction.profiles.email || 'Sem nome'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDate(transaction.date)}
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
                    {transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex space-x-1">
                  {onEdit && (transaction.user_id === user?.id || canEditOthers) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(transaction)}
                      className="text-primary hover:text-primary h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (transaction.user_id === user?.id || canDeleteOthers) && (
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
              // Mostrar apenas algumas páginas
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