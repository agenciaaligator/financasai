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

  const checkEmailExists = async (email: string) => {
    const { data, error } = await supabase.rpc('check_user_exists', {
      email_to_check: email
    });
    
    if (error) {
      console.error('Erro ao verificar email:', error);
      return false;
    }
    
    return data;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // Verificar PRIMEIRO se o email já existe
    try {
      const emailExists = await checkEmailExists(email);
      
      if (emailExists) {
        toast({
          title: "📧 Email já cadastrado",
          description: "Este email já possui uma conta. Clique em 'Fazer Login' abaixo para acessar sua conta existente.",
          variant: "destructive"
        });
        return { error: { message: 'Email already exists' } };
      }
    } catch (err) {
      console.error('Erro na verificação prévia do email:', err);
      // Continue com o processo se a verificação falhar
    }

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
        // Melhor tratamento de erro para email duplicado
        if (error.message.includes('User already registered') || 
            error.message.includes('already been registered') ||
            error.message.includes('email address is already registered') ||
            error.message.includes('already_registered') ||
            error.message.includes('A user with this email address has already been registered')) {
          toast({
            title: "📧 Email já cadastrado",
            description: "Este email já possui uma conta. Clique em 'Fazer Login' abaixo para acessar sua conta existente.",
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
            description: error.message,
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
      const { error } = await supabase.auth.signOut();
      
      // Ignorar erros de "sessão não encontrada" - usuário já está deslogado
      if (error && !error.message.includes('session_not_found') && 
          !error.message.includes('Session not found') &&
          !error.message.includes('Auth session missing')) {
        console.warn('[useAuth] Erro ao fazer logout (não crítico):', error);
        toast({
          title: "Aviso",
          description: "Houve um problema ao desconectar, mas você será redirecionado.",
          variant: "default"
        });
      } else {
        toast({
          title: "✅ Logout realizado",
          description: "Até breve!",
        });
      }
      
      // SEMPRE limpar o estado local e redirecionar
      setSession(null);
      setUser(null);
      
      // Garantir redirecionamento para login
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
      
    } catch (err) {
      console.error('[useAuth] Erro inesperado no logout:', err);
      // Mesmo com erro, limpar tudo
      setSession(null);
      setUser(null);
      window.location.href = '/';
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
        if (error.message.includes('User not found')) {
          toast({
            title: "📧 Email não encontrado",
            description: "Não encontramos uma conta com este email. Verifique se está correto ou crie uma nova conta.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "❌ Erro ao enviar email",
            description: error.message,
            variant: "destructive"
          });
        }
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
    checkEmailExists,
    resetPassword,
    updatePassword
  };
}