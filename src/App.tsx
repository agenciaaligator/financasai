import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ChoosePlan from "./pages/ChoosePlan";
import Register from "./pages/Register";
import Welcome from "./pages/Welcome";
import ResetPassword from "./pages/ResetPassword";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancelled from "./pages/PaymentCancelled";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import SubscriptionInactive from "./pages/SubscriptionInactive";
import AuthCallback from "./pages/AuthCallback";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const AuthEventHandler = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  
  // Detecção SÍNCRONA durante render - antes de qualquer child montar
  const [isRecovery] = useState(() => {
    const hash = window.location.hash;
    return hash.includes('type=recovery');
  });

  useEffect(() => {
    // Para PKCE flow (tokens em ?code=, sem hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password', { replace: true });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Se recovery detectado no hash, redirecionar ANTES de renderizar children
  if (isRecovery) {
    const hash = window.location.hash;
    return <Navigate to={`/reset-password${hash}`} replace />;
  }

  return <>{children}</>;
};

const AdminRoute = () => {
  const { isAdmin, loading } = useUserRole();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  return isAdmin ? <AdminPanel /> : <Navigate to="/" replace />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthEventHandler>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/choose-plan" element={<ChoosePlan />} />
              <Route path="/register" element={<Register />} />
              <Route path="/boas-vindas" element={<Welcome />} />
              <Route path="/signup" element={<Navigate to="/choose-plan" replace />} />
              <Route path="/cadastro" element={
                <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
                  <SignUpForm />
                </div>
              } />
              <Route path="/admin" element={<AdminRoute />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/set-password" element={<ResetPassword />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/payment-cancelled" element={<PaymentCancelled />} />
              <Route path="/subscription-inactive" element={<SubscriptionInactive />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/termos" element={<Terms />} />
              <Route path="/privacidade" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthEventHandler>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
