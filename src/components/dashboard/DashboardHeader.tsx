import { Button } from "@/components/ui/button";
import { LogOut, User, AlertCircle, X } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";

interface DashboardHeaderProps {
  userEmail?: string;
  onSignOut: () => void;
  minimal?: boolean;
}

export function DashboardHeader({ userEmail, onSignOut, minimal = false }: DashboardHeaderProps) {
  // FASE 5: Banner de backfill
  const { role, organization_id, canViewOthers } = useOrganizationPermissions();
  const [showBackfillBanner, setShowBackfillBanner] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    // Só mostra para owners com multi-user
    if (role === 'owner' && canViewOthers) {
      const hasSeenBackfill = localStorage.getItem('backfillCompleted');
      if (!hasSeenBackfill) {
        setShowBackfillBanner(true);
      }
    }
  }, [role, canViewOthers]);

  const handleBackfill = async () => {
    if (!organization_id) return;
    
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-transactions', {
        body: { organization_id }
      });
      
      if (error) throw error;
      
      const result = data as { count: number; totalVisible: number };
      
      alert(
        `Backfill concluído!\n\n` +
        `${result.count} transações corrigidas.\n` +
        `Agora você vê ${result.totalVisible} transações da equipe nesta organização.`
      );
      
      // Esconder banner após sucesso
      localStorage.setItem('backfillCompleted', 'true');
      setShowBackfillBanner(false);
      
      // Reload para atualizar dados
      window.location.reload();
    } catch (error: any) {
      console.error('[BACKFILL] Erro:', error);
      alert('Erro ao executar backfill: ' + error.message);
    } finally {
      setBackfilling(false);
    }
  };

  if (minimal) {
    return (
      <div className="flex items-center gap-3">
        <LanguageSelector />
        <Button 
          onClick={onSignOut}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* FASE 5: Banner de backfill */}
      {showBackfillBanner && (
        <Alert className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <strong className="text-yellow-900 dark:text-yellow-100">
                Dados da equipe podem estar pendentes
              </strong>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                Algumas transações dos membros podem estar sem organização vinculada. 
                Clique para corrigir e visualizar todas as transações da equipe.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleBackfill}
                disabled={backfilling}
                size="sm"
                variant="outline"
              >
                {backfilling ? 'Corrigindo...' : 'Corrigir agora'}
              </Button>
              <Button
                onClick={() => {
                  localStorage.setItem('backfillCompleted', 'true');
                  setShowBackfillBanner(false);
                }}
                size="sm"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Dashboard Financeiro
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas finanças de forma inteligente
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {userEmail}
            </span>
          </div>
          
          <LanguageSelector />
          
          <Button 
            onClick={onSignOut}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </>
  );
}