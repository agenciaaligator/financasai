import { Button } from "@/components/ui/button";
import { DollarSign, LogOut } from "lucide-react";

interface DashboardHeaderProps {
  userEmail?: string;
  onSignOut: () => void;
}

export function DashboardHeader({ userEmail, onSignOut }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gradient-primary rounded-lg">
          <DollarSign className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">FinanceAI</h1>
          <p className="text-muted-foreground">Bem-vindo, {userEmail}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}