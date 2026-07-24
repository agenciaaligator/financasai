import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { buildSiteUrl } from '@/lib/siteUrl';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();


  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);


  // NOTE: signUp removed intentionally. The onboarding flow uses
  // supabase.auth.signUp directly inside src/pages/Register.tsx, which
  // performs RPC pre-checks (check_email_available, check_phone_available),
  // localized error messages, and proper plan binding. Do not re-introduce
  // a signUp helper here without those guarantees.

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Email não confirmado
      if (error.message.includes('Email not confirmed')) {
        toast({
          title: "📧 Email não confirmado",
          description: "Verifique seu email e clique no link de confirmação para fazer login. Confira também a pasta de spam.",
          variant: "destructive"
        });
        return { error };
      }
      
      // Credenciais inválidas (senha errada OU email não existe)
      if (error.message.includes('Invalid login credentials')) {
        toast({
          title: "🔑 Email ou senha incorretos",
          description: "Verifique suas credenciais e tente novamente. Se você não tem uma conta, clique em 'Criar conta' abaixo.",
          variant: "destructive",
          duration: 6000,
        });
        return { error };
      }
      
      // Erros gerais
      toast({
        title: "❌ Erro no login",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }

    toast({
      title: "Que bom te ver! 💚",
      description: "Tava te esperando, viu?",
    });


    return { error: null };
  };

  const signOut = async () => {
    try {
      console.log('[LOGOUT] Iniciando processo de logout...');
      
      // 1. Preservar preferências antes de limpar
      const loginPreferences = localStorage.getItem('i18nextLng');
      
      // 2. LIMPAR ESTADO LOCAL IMEDIATAMENTE
      setSession(null);
      setUser(null);
      
      // 3. CHAMAR LOGOUT DO SUPABASE PRIMEIRO
      console.log('[LOGOUT] Chamando supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      
      // Ignorar erros de "sessão não encontrada"
      if (error && !error.message.includes('session_not_found') && 
          !error.message.includes('Session not found') &&
          !error.message.includes('Auth session missing')) {
        console.warn('[LOGOUT] Erro ao fazer logout (não crítico):', error);
      }
      
      // 4. LIMPAR STORAGES APÓS signOut bem-sucedido
      console.log('[LOGOUT] Limpando localStorage e sessionStorage...');
      localStorage.clear();
      sessionStorage.clear();
      if (loginPreferences) {
        localStorage.setItem('i18nextLng', loginPreferences);
      }
      
      // 5. LIMPAR CACHES DO BROWSER
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        } catch (cacheError) {
          console.warn('[LOGOUT] Erro ao limpar caches:', cacheError);
        }
      }
      
      // 6. MARCAR QUE O LOGOUT FOI FORÇADO
      sessionStorage.setItem('force_logout', Date.now().toString());
      
      // 7. TOAST DE SUCESSO
      toast({
        title: "✅ Logout realizado",
        description: "Até breve!",
      });
      
      // 8. FORÇAR REDIRECT IMEDIATO
      console.log('[LOGOUT] Redirecionando para login...');
      window.location.href = '/?logout=' + Date.now();
      
    } catch (err) {
      console.error('[LOGOUT] Erro inesperado no logout:', err);
      
      // FALLBACK - Mesmo com erro, forçar limpeza total
      localStorage.clear();
      sessionStorage.clear();
      setSession(null);
      setUser(null);
      
      toast({
        title: "⚠️ Logout forçado",
        description: "Você será redirecionado para o login.",
        variant: "default"
      });
      
      window.location.href = '/?force=' + Date.now();
    }
  };

  const resetPassword = async (email: string) => {
    // SEMPRE usar o domínio canônico oficial. Nunca usar window.location.origin
    // aqui — caso contrário, o link do e-mail apontaria para o host onde o usuário
    // estava (ex.: domínio de preview), levando a página inexistente.
    const redirectUrl = buildSiteUrl('/reset-password');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        // Generic error message to prevent user enumeration
        toast({
          title: "⚠️ Problema ao processar solicitação",
          description: "Verifique se o email está correto e tente novamente. Se o email existir em nossa base, você receberá instruções de recuperação.",
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "📧 Email enviado!",
        description: "Verifique seu email para o link de recuperação de senha. Confira também a pasta de spam.",
      });
      
      return { error: null };
    } catch (err: any) {
      toast({
        title: "💥 Erro inesperado",
        description: "Ocorreu um erro. Verifique sua conexão e tente novamente.",
        variant: "destructive"
      });
      return { error: err };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({
          title: "❌ Erro ao alterar senha",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "✅ Senha alterada!",
        description: "Sua senha foi alterada com sucesso.",
      });
      
      return { error: null };
    } catch (err: any) {
      toast({
        title: "💥 Erro inesperado",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive"
      });
      return { error: err };
    }
  };

  return {
    user,
    session,
    loading,
    signIn,
    signOut,
    resetPassword,
    updatePassword
  };
}