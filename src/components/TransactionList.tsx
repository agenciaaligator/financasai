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
    return new Date(dateString).toLocaleDateString('pt-BR');
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${
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
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium">{transaction.title}</p>
                    {transaction.categories && (
                      <Badge variant="outline" className="text-xs">
                        {transaction.categories.name}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {transaction.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(transaction.date)}
                    {transaction.description && ` • ${transaction.description}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <p className={`font-bold ${
                    transaction.type === 'income' ? 'text-success' : 'text-destructive'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(transaction)}
                    className="text-primary hover:text-primary"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(transaction.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}