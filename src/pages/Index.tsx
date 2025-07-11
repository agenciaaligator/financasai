import { useState } from "react";
import { FinancialDashboard } from "@/components/FinancialDashboard";
import { LoginForm } from "@/components/LoginForm";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
        <LoginForm 
          onToggleMode={() => setIsSignUp(!isSignUp)}
          isSignUp={isSignUp}
        />
      </div>
    );
  }

  return <FinancialDashboard />;
};

export default Index;
