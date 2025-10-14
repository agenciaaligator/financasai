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
      setLoading(true);
      console.log('[useGoogleCalendar] Iniciando conexão com Google Calendar...');
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (!data?.authUrl) {
        throw new Error('URL de autenticação não foi gerada');
      }

      const authUrl = data.authUrl;
      console.log('[useGoogleCalendar] URL de autenticação gerada');

      // Detectar se está em iframe (Lovable Preview)
      const isInIframe = window.self !== window.top;
      
      if (isInIframe) {
        console.log('[useGoogleCalendar] Detectado iframe, abrindo em nova aba...');
        
        // Tentar abrir em nova aba
        const newWindow = window.open(authUrl, '_blank', 'noopener,noreferrer');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Pop-up foi bloqueado
          toast({
            title: 'Pop-up bloqueado',
            description: 'Por favor, permita pop-ups para este site e tente novamente. Clique no botão Conectar novamente após permitir.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Autenticação em andamento',
            description: 'Complete o login no Google na nova aba.',
          });
        }
      } else {
        // Não está em iframe, redirecionar normalmente
        console.log('[useGoogleCalendar] Redirecionando para Google...');
        window.location.assign(authUrl);
      }
      
    } catch (error: any) {
      console.error('[useGoogleCalendar] Erro ao conectar:', error);
      console.error('[useGoogleCalendar] Detalhes completos:', JSON.stringify(error, null, 2));
      
      let title = 'Erro ao conectar';
      let description = 'Não foi possível iniciar a conexão com o Google Calendar.';
      
      // Erro de função não encontrada
      if (error.message?.includes('FunctionsRelayError') || error.message?.includes('not found')) {
        description = 'Função de autenticação não encontrada. Por favor, aguarde o deploy das edge functions ou contate o suporte.';
      }
      // Erro de configuração do backend
      else if (error.message?.includes('Missing Google OAuth configuration')) {
        title = 'Configuração incompleta';
        description = 'As credenciais do Google não estão configuradas no backend. Por favor, contate o suporte.';
      }
      // Erro 400 do Google (redirect_uri ou domínios)
      else if (error.message?.includes('400') || error.message?.includes('redirect_uri_mismatch')) {
        title = 'Erro de configuração do Google';
        description = 'O Google recusou a conexão. Verifique se os domínios autorizados e redirect URI estão corretos no Google Cloud Console.';
      }
      // Erro 403 - acesso negado
      else if (error.message?.includes('403') || error.message?.includes('access_denied')) {
        title = 'Acesso negado';
        description = 'Verifique se seu email está cadastrado como Usuário de Teste no Google Cloud Console (modo Testing).';
      }
      // Erro de rede
      else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        title = 'Erro de conexão';
        description = 'Verifique sua conexão com a internet e tente novamente.';
      }
      // Erro de navegação (iframe blocked)
      else if (error.message?.includes('Location') || error.message?.includes('href')) {
        title = 'Navegação bloqueada';
        description = 'O navegador bloqueou a navegação. Tente permitir pop-ups ou abrir o app em uma nova aba.';
      }
      // Outros erros
      else if (error.message) {
        description = `Erro: ${error.message}`;
      }
      
      toast({
        title,
        description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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