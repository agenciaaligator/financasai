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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Check subscription status after authentication
        if (session?.user && event === 'SIGNED_IN') {
          setTimeout(() => {
            supabase.functions.invoke('check-subscription').catch(error => {
              console.error('Error checking subscription on login:', error);
            });
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Check subscription on initial load
      if (session?.user) {
        setTimeout(() => {
          supabase.functions.invoke('check-subscription').catch(error => {
            console.error('Error checking subscription on load:', error);
          });
        }, 0);
      }
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
      if (error.message.includes('Invalid login credentials') || 
          error.message.includes('Email not confirmed')) {
        toast({
          title: "🔑 Erro no login",
          description: "Email ou senha incorretos. Verifique se você confirmou seu email pelo link enviado.",
          variant: "destructive"
        });
      } else if (error.message.includes('Email not confirmed')) {
        toast({
          title: "📧 Email não confirmado",
          description: "Verifique seu email e clique no link de confirmação para fazer login.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "❌ Erro no login",
          description: error.message,
          variant: "destructive"
        });
      }
      return { error };
    }

    toast({
      title: "✅ Login realizado!",
      description: "Bem-vindo de volta!",
    });

    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até breve!",
      });
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