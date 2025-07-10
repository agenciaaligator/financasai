import { useState } from "react";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/LoginForm";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = (email: string, password: string) => {
    // Aqui você integrará com Supabase para autenticação real
    console.log('Login attempt:', { email, password });
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <LoginForm 
          onLogin={handleLogin}
          onToggleMode={() => setIsSignUp(!isSignUp)}
          isSignUp={isSignUp}
        />
      </div>
    );
  }

  return <FinancialDashboard />;
};

export default Index;
