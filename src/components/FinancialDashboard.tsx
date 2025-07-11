import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionForm } from "./TransactionForm";
import { TransactionList } from "./TransactionList";
import { FinancialChart } from "./FinancialChart";
import { CategoryManager } from "./CategoryManager";
import { ProfileSettings } from "./ProfileSettings";
import { EditTransactionModal } from "./EditTransactionModal";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PlusCircle, 
  AlertTriangle,
  LogOut,
  User,
  Settings,
  Tags
} from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";

export function FinancialDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { user, signOut } = useAuth();
  const { transactions, categories, loading, balance, totalIncome, totalExpenses, addTransaction, deleteTransaction, refetch } = useTransactions();

  const handleAddTransaction = async (transaction: any) => {
    const result = await addTransaction(transaction);
    if (!result?.error) {
      setShowForm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isNegative = balance < 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">FinanceAI</h1>
              <p className="text-muted-foreground">Bem-vindo, {user?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Alerta de Saldo Negativo */}
        {isNegative && (
          <Card className="mb-6 border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-destructive font-medium">Atenção! Seu saldo está negativo</p>
                  <p className="text-sm text-muted-foreground">
                    Considere revisar seus gastos ou aumentar sua receita
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-success'}`}>
                R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <Badge variant={isNegative ? "destructive" : "default"} className="mt-2">
                {isNegative ? 'Negativo' : 'Positivo'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Este mês
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Este mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Botão Adicionar Transação */}
        <div className="mb-6">
          <Button 
            onClick={() => setShowForm(!showForm)} 
            className="bg-gradient-primary hover:shadow-primary transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nova Transação'}
          </Button>
        </div>

        {showForm && (
          <div className="mb-6">
            <TransactionForm 
              onSubmit={handleAddTransaction}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Conteúdo Principal */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted/30">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Transações</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center space-x-2">
              <Tags className="h-4 w-4" />
              <span>Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Perfil</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <CardTitle>Gráfico Financeiro</CardTitle>
                </CardHeader>
                <CardContent>
                  <FinancialChart transactions={transactions} />
                </CardContent>
              </Card>

              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <CardTitle>Transações Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <TransactionList 
                    transactions={transactions.slice(0, 10)} 
                    onDelete={deleteTransaction}
                    onEdit={setEditingTransaction}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader>
                <CardTitle>Todas as Transações</CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionList 
                  transactions={transactions} 
                  onDelete={deleteTransaction}
                  onEdit={setEditingTransaction}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManager 
              categories={categories} 
              onRefresh={refetch}
            />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>
        </Tabs>

        {/* Informações do WhatsApp */}
        <Card className="mt-6 bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Integração WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Você pode adicionar transações via WhatsApp usando os seguintes formatos:
            </p>
            <div className="bg-muted/30 p-4 rounded-lg space-y-2">
              <p className="text-sm"><strong>Exemplos:</strong></p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• "gasto 50 mercado" - adiciona despesa</li>
                <li>• "receita 1000 salario" - adiciona receita</li>
                <li>• "+100 freelance" - adiciona receita</li>
                <li>• "-30 combustível" - adiciona despesa</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Edição */}
        <EditTransactionModal
          transaction={editingTransaction}
          categories={categories}
          onClose={() => setEditingTransaction(null)}
          onUpdate={refetch}
        />
      </div>
    </div>
  );
}