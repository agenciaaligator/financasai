import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarConnection {
  calendar_email: string;
  calendar_name: string;
  is_active: boolean;
}

export const useGoogleCalendar = () => {
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkConnection = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setConnection(null);
        return;
      }

      const { data, error } = await supabase
        .from('calendar_connections')
        .select('calendar_email, calendar_name, is_active')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
      setConnection(data);
    } catch (error) {
      console.error('Error checking calendar connection:', error);
      setConnection(null);
    } finally {
      setLoading(false);
    }
  };

  const connect = async () => {
    try {
      const session = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`
        }
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        const url = data.authUrl;
        
        // Detectar se está em iframe e forçar navegação no top-level
        if (window.top && window.top !== window.self) {
          window.top.location.href = url;
        } else {
          window.location.href = url;
        }
      }
    } catch (error: any) {
      console.error('Error connecting to Google Calendar:', error);
      
      // Log completo do erro para debug
      console.error('Full error object:', JSON.stringify(error, null, 2));
      
      let description = 'Não foi possível iniciar a conexão com o Google Calendar.';
      let title = 'Erro ao conectar';
      
      // Verificar se é erro de função não encontrada
      if (error.message?.includes('FunctionsRelayError') || error.message?.includes('not found')) {
        description = 'Função de autenticação não encontrada. Aguarde o deploy das edge functions.';
      }
      // Verificar se é erro de configuração do backend
      else if (error.message?.includes('Missing Google OAuth configuration')) {
        description = 'Configuração incompleta no backend. Verifique as variáveis de ambiente GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_CALENDAR_REDIRECT_URI.';
      }
      // Erro de permissão do Google (403 - será mostrado na tela do Google, não aqui)
      else if (error.message?.includes('403') || error.message?.includes('access_denied')) {
        description = 'Acesso negado pelo Google. Verifique se seu email está cadastrado como Usuário de Teste no Google Cloud Console.';
      }
      // Erro de rede
      else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        description = 'Erro de conexão. Verifique sua internet e tente novamente.';
      }
      // Outros erros: mostrar mensagem original
      else if (error.message) {
        description = `Erro: ${error.message}`;
      }
      
      toast({
        title,
        description,
        variant: 'destructive',
      });
    }
  };

  const disconnect = async () => {
    try {
      const { error } = await supabase.functions.invoke('google-calendar-disconnect');
      
      if (error) throw error;
      
      setConnection(null);
      toast({
        title: 'Desconectado',
        description: 'Google Calendar desconectado com sucesso.',
      });
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      toast({
        title: 'Erro ao desconectar',
        description: 'Não foi possível desconectar o Google Calendar.',
        variant: 'destructive',
      });
    }
  };

  const syncEvent = async (action: 'create' | 'update' | 'delete', commitmentId: string) => {
    try {
      const { error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action, commitmentId },
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error syncing with Google Calendar:', error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    checkConnection();
    
    // Verificar parâmetros de callback
    const urlParams = new URLSearchParams(window.location.search);
    const googleStatus = urlParams.get('google');
    
    if (googleStatus === 'success') {
      toast({
        title: 'Google Calendar conectado!',
        description: 'Seus compromissos serão sincronizados automaticamente.',
      });
      checkConnection();
      // Limpar parâmetro da URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (googleStatus === 'error') {
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível conectar ao Google Calendar.',
        variant: 'destructive',
      });
      // Limpar parâmetro da URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return {
    connection,
    loading,
    isConnected: !!connection,
    connect,
    disconnect,
    syncEvent,
    refresh: checkConnection,
  };
};