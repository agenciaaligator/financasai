import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Plans from "./pages/Plans";
import ResetPassword from "./pages/ResetPassword";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancelled from "./pages/PaymentCancelled";
import NotFound from "./pages/NotFound";
import GCBridge from "./pages/GCBridge";
import GCAuthResult from "./pages/GCAuthResult";
import InviteAccept from "./pages/InviteAccept";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { useUserRole } from "@/hooks/useUserRole";
import { SignUpForm } from "@/components/auth/SignUpForm";

const queryClient = new QueryClient();

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
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/cadastro" element={
              <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
                <SignUpForm />
              </div>
            } />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/payment-cancelled" element={<PaymentCancelled />} />
            <Route path="/gc-bridge" element={<GCBridge />} />
            <Route path="/gc-done" element={<GCAuthResult />} />
            <Route path="/invite/:token" element={<InviteAccept />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
