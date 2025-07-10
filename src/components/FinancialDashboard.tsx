import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Eye,
  Plus,
  CreditCard,
  PiggyBank,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { TransactionForm } from "./TransactionForm";
import { TransactionList } from "./TransactionList";
import { FinancialChart } from "./FinancialChart";

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
}

export function FinancialDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: '1',
      type: 'income',
      amount: 5000,
      category: 'Salário',
      description: 'Salário mensal',
      date: '2024-01-15'
    },
    {
      id: '2', 
      type: 'expense',
      amount: 1200,
      category: 'Moradia',
      description: 'Aluguel',
      date: '2024-01-10'
    },
    {
      id: '3',
      type: 'expense', 
      amount: 800,
      category: 'Alimentação',
      description: 'Supermercado',
      date: '2024-01-08'
    }
  ]);

  const [showTransactionForm, setShowTransactionForm] = useState(false);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;
  const isNegative = balance < 0;

  const addTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction = {
      ...transaction,
      id: Date.now().toString()
    };
    setTransactions([newTransaction, ...transactions]);
    setShowTransactionForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20">
      {/* Header */}
      <div className="bg-gradient-header shadow-soft border-b">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                <Eye className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Agente Financeiro</h1>
                <p className="text-white/80">Seu assistente pessoal de finanças</p>
              </div>
            </div>
            <Button 
              onClick={() => setShowTransactionForm(!showTransactionForm)}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isNegative ? 'text-destructive' : 'text-success'}`}>
                R$ {balance.toLocaleString('pt-BR')}
              </div>
              <Badge variant={isNegative ? "destructive" : "secondary"} className="mt-2">
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
                R$ {totalIncome.toLocaleString('pt-BR')}
              </div>
              <p className="text-xs text-muted-foreground">
                +{((totalIncome / (totalIncome + totalExpenses)) * 100).toFixed(1)}% do total
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
                R$ {totalExpenses.toLocaleString('pt-BR')}
              </div>
              <p className="text-xs text-muted-foreground">
                {((totalExpenses / (totalIncome + totalExpenses)) * 100).toFixed(1)}% do total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transações</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
              <p className="text-xs text-muted-foreground">
                Este mês
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conteúdo Principal */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white shadow-soft">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="transactions">Transações</TabsTrigger>
            <TabsTrigger value="analytics">Análises</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {showTransactionForm && (
                <Card className="lg:col-span-2 bg-gradient-card shadow-card border-0">
                  <CardHeader>
                    <CardTitle>Nova Transação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TransactionForm onSubmit={addTransaction} />
                  </CardContent>
                </Card>
              )}
              
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
                  <TransactionList transactions={transactions.slice(0, 5)} />
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
                <TransactionList transactions={transactions} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <CardTitle>Análise por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Gráficos de categorias em desenvolvimento...</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader>
                  <CardTitle>Tendências Mensais</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Análise de tendências em desenvolvimento...</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}