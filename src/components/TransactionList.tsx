import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Trash2, Edit } from "lucide-react";
import { Transaction } from '@/hooks/useTransactions';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete?: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, onDelete, onEdit }: TransactionListProps) {
  const formatDate = (dateString: string) => {
    // Parse date manually to avoid timezone issues
    // dateString is in format YYYY-MM-DD
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma transação encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <Card key={transaction.id} className="border-l-4 border-l-primary/20 hover:shadow-soft transition-shadow">
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
                      <Badge variant="secondary" className="text-xs">
                        {transaction.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
                      </Badge>
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
                  <p className={`font-bold text-sm sm:text-base ${
                    transaction.type === 'income' ? 'text-success' : 'text-destructive'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(transaction.id)}
                      className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}