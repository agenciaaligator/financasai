import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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


  const signUp = async (email: string, password: string, fullName: string) => {

    // Usar URL da aplicação publicada ou localhost se em desenvolvimento
    const redirectUrl = window.location.hostname === 'localhost' 
      ? `${window.location.origin}/`
      : `https://${window.location.hostname}/`;
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        // Generic error messages to prevent user enumeration
        if (error.message.includes('User already registered') || 
            error.message.includes('already been registered') ||
            error.message.includes('email address is already registered') ||
            error.message.includes('already_registered') ||
            error.message.includes('A user with this email address has already been registered')) {
          toast({
            title: "⚠️ Erro no cadastro",
            description: "Não foi possível completar o cadastro. Verifique seus dados ou tente fazer login se já possui uma conta.",
            variant: "destructive"
          });
        } else if (error.message.includes('Password should be at least')) {
          toast({
            title: "🔒 Senha muito fraca",
            description: "A senha deve ter pelo menos 6 caracteres.",
            variant: "destructive"
          });
        } else if (error.message.includes('Signup is disabled')) {
          toast({
            title: "⚠️ Cadastro temporariamente indisponível",
            description: "Tente novamente em alguns minutos.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "❌ Erro no cadastro",
            description: "Não foi possível completar o cadastro. Verifique seus dados e tente novamente.",
            variant: "destructive"
          });
        }
        return { error };
      }

      // Se o usuário foi criado mas precisa confirmar email
      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "✅ Cadastro realizado com sucesso!",
          description: "Verifique seu email para confirmar a conta e fazer login. Confira também a pasta de spam ou lixo eletrônico.",
        });
      } else if (data.user) {
        toast({
          title: "✅ Cadastro realizado!",
          description: "Bem-vindo! Você já pode começar a usar o sistema.",
        });
      }

      return { error: null, data };
    } catch (err: any) {
      toast({
        title: "💥 Erro no cadastro",
        description: "Ocorreu um erro inesperado. Verifique sua conexão e tente novamente.",
        variant: "destructive"
      });
      return { error: err };
    }
  };

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
      title: "✅ Login realizado!",
      description: "Bem-vindo de volta!",
    });

    return { error: null };
  };

  const signOut = async () => {
    try {
      console.log('[LOGOUT MOBILE] Iniciando processo de logout...');
      
      // 1. LIMPAR TODOS OS STORAGES ANTES de chamar Supabase
      console.log('[LOGOUT MOBILE] Limpando localStorage e sessionStorage...');
      const loginPreferences = localStorage.getItem('i18nextLng'); // Preservar idioma
      localStorage.clear();
      sessionStorage.clear();
      if (loginPreferences) {
        localStorage.setItem('i18nextLng', loginPreferences);
      }
      
      // 2. LIMPAR CACHES DO BROWSER
      if ('caches' in window) {
        try {
          console.log('[LOGOUT MOBILE] Limpando caches do browser...');
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
          console.log('[LOGOUT MOBILE] Caches limpos:', cacheNames.length);
        } catch (cacheError) {
          console.warn('[LOGOUT MOBILE] Erro ao limpar caches:', cacheError);
        }
      }
      
      // 3. LIMPAR ESTADO LOCAL IMEDIATAMENTE
      setSession(null);
      setUser(null);
      
      // 4. CHAMAR LOGOUT DO SUPABASE
      console.log('[LOGOUT MOBILE] Chamando supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut();
      
      // Ignorar erros de "sessão não encontrada" - usuário já está deslogado
      if (error && !error.message.includes('session_not_found') && 
          !error.message.includes('Session not found') &&
          !error.message.includes('Auth session missing')) {
        console.warn('[LOGOUT MOBILE] Erro ao fazer logout (não crítico):', error);
      }
      
      // 5. MARCAR QUE O LOGOUT FOI FORÇADO
      sessionStorage.setItem('force_logout', Date.now().toString());
      
      // 6. TOAST DE SUCESSO
      toast({
        title: "✅ Logout realizado",
        description: "Até breve!",
      });
      
      // 7. FORÇAR REDIRECT IMEDIATO COM CACHE BUSTING
      console.log('[LOGOUT MOBILE] Redirecionando para login...');
      window.location.href = '/?logout=' + Date.now();
      
    } catch (err) {
      console.error('[LOGOUT MOBILE] Erro inesperado no logout:', err);
      
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
      
      // Redirect forçado com timestamp
      window.location.href = '/?force=' + Date.now();
    }
  };

  const resetPassword = async (email: string) => {
    // Usar URL da aplicação atual para o redirect
    const redirectUrl = `${window.location.origin}/reset-password`;
    
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
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword
  };
}