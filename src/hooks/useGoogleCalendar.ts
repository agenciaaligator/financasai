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
      
      // Obter userId e sessão antes de invocar a função
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || null;
      
      // Logs de diagnóstico do usuário
      console.log('[useGoogleCalendar] User obtido:', {
        id: user?.id,
        email: user?.email,
        exists: !!user
      });
      console.log('[useGoogleCalendar] Session token prefix:', accessToken ? accessToken.slice(0, 12) + '...' : null);
      
      // Calcular appOrigin apropriado
      const origin = window.location.origin;
      const isEditor = origin.includes('lovableproject.com') || origin.includes('lovable.dev');
      const isInIframe = window.self !== window.top;
      const appOrigin = isEditor ? 'https://financasai.lovable.app' : origin;
      
      // Logs de diagnóstico do ambiente
      console.log('[useGoogleCalendar] Ambiente:', {
        origin,
        isEditor,
        isInIframe,
        appOrigin
      });
      
      // Verificar se temos user e token
      if (!user?.id || !accessToken) {
        console.error('[useGoogleCalendar] Faltam dados críticos:', {
          hasUserId: !!user?.id,
          hasToken: !!accessToken
        });
        toast({
          title: "Erro",
          description: "Sessão inválida. Faça login novamente.",
          variant: "destructive"
        });
        return;
      }
      
      // Preparar payload
      const payload = {
        appOrigin,
        userId: user.id
      };
      
      console.log('[useGoogleCalendar] Payload para auth:', {
        hasUserId: !!payload.userId,
        appOrigin: payload.appOrigin
      });
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      });

      let authUrl = data?.authUrl;

      // Fallback: se POST falhar ou não retornar authUrl, tentar GET
      if (error || !authUrl) {
        console.warn('[useGoogleCalendar] POST falhou, tentando fallback GET...', error);
        
        const functionUrl = `https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/google-calendar-auth?uid=${encodeURIComponent(user.id)}&o=${encodeURIComponent(appOrigin)}`;
        console.log('[useGoogleCalendar] Fallback GET URL:', functionUrl);
        
        try {
          const response = await fetch(functionUrl, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`GET request failed: ${response.status}`);
          }
          
          const fallbackData = await response.json();
          authUrl = fallbackData?.authUrl;
          
          console.log('[useGoogleCalendar] Fallback GET successful, authUrl obtained');
        } catch (fallbackError) {
          console.error('[useGoogleCalendar] Fallback GET também falhou:', fallbackError);
          toast({
            title: "Erro",
            description: "Erro ao conectar com Google Calendar (POST e GET falharam)",
            variant: "destructive"
          });
          throw fallbackError;
        }
      }

      if (!authUrl) {
        throw new Error('URL de autenticação não foi gerada');
      }
      console.log('[useGoogleCalendar] URL de autenticação gerada');

      // Construir URL da ponte usando HTML estático (para evitar 404)
      const bridgeUrl = `${appOrigin}/gc-bridge.html?u=${encodeURIComponent(authUrl)}`;
      console.log('[useGoogleCalendar] URL da ponte (HTML estático):', bridgeUrl);

      // isInIframe já foi calculado acima
      
      if (isInIframe) {
        console.log('[useGoogleCalendar] Detectado iframe, abrindo ponte em nova aba...');
        
        // Tentar abrir a ponte em nova aba
        const newWindow = window.open(bridgeUrl, '_blank', 'noopener,noreferrer');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Pop-up foi bloqueado
          toast({
            title: 'Pop-up bloqueado',
            description: 'Por favor, permita pop-ups para este site e tente novamente. Verifique o ícone de bloqueio na barra de endereço.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Autenticação em andamento',
            description: 'Complete o login no Google na nova aba que foi aberta.',
          });
        }
      } else {
        // Não está em iframe, redirecionar para a ponte (mesma aba)
        console.log('[useGoogleCalendar] Redirecionando para ponte...');
        window.location.assign(bridgeUrl);
      }
      
    } catch (error: any) {
      console.error('[useGoogleCalendar] Erro ao conectar:', error);
      console.error('[useGoogleCalendar] Detalhes completos:', JSON.stringify(error, null, 2));
      
      let title = 'Erro ao conectar';
      let description = 'Não foi possível iniciar a conexão com o Google Calendar.';
      
      // Credenciais inválidas do Google (client/secret)
      if (error.message?.toLowerCase?.().includes('invalid_client') || error.message?.toLowerCase?.().includes('unauthorized')) {
        title = 'Configuração do Google inválida';
        description = 'GOOGLE_CLIENT_SECRET e CLIENT_ID podem estar incorretos. Verifique as Secrets no Supabase e tente novamente.';
      }
      // Erro de função não encontrada
      else if (error.message?.includes('FunctionsRelayError') || error.message?.includes('not found')) {
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
        description = 'O Google recusou a conexão. Pode levar alguns minutos após alterações no Google Cloud Console. Verifique se os domínios e redirect URI estão corretos.';
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
      // Erro de navegação (iframe/extensão blocked)
      else if (error.message?.includes('Location') || error.message?.includes('href') || error.message?.includes('blocked')) {
        title = 'Navegação bloqueada';
        description = 'Uma extensão do navegador ou configuração de segurança bloqueou a conexão. Tente em janela anônima ou desative extensões temporariamente.';
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

      // Notificar outras abas/janelas sobre a conexão concluída
      try {
        localStorage.setItem('gc_connected', Date.now().toString());
        const bc = new BroadcastChannel('gc-auth');
        bc.postMessage('connected');
        bc.close();
      } catch (e) {
        console.warn('[useGoogleCalendar] BroadcastChannel indisponível', e);
      }

      // Limpar parâmetro da URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (googleStatus === 'error') {
      toast({
        title: 'Erro ao conectar',
        description: 'Não foi possível conectar ao Google Calendar.',
        variant: 'destructive',
      });

      // Notificar erro para outras abas/janelas
      try {
        localStorage.setItem('gc_disconnected', Date.now().toString());
        const bc = new BroadcastChannel('gc-auth');
        bc.postMessage('disconnected');
        bc.close();
      } catch (e) {
        console.warn('[useGoogleCalendar] BroadcastChannel indisponível', e);
      }

      // Limpar parâmetro da URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Listeners para atualizar conexão em foco/abas
  useEffect(() => {
    const onFocus = () => { checkConnection(); };
    window.addEventListener('focus', onFocus);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gc_connected' || e.key === 'gc_disconnected') {
        checkConnection();
      }
    };
    window.addEventListener('storage', onStorage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('gc-auth');
      bc.onmessage = (ev) => {
        if (ev?.data === 'connected' || ev?.data === 'disconnected') {
          checkConnection();
        }
      };
    } catch (e) {
      console.warn('[useGoogleCalendar] BroadcastChannel indisponível', e);
    }

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
      if (bc) bc.close();
    };
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