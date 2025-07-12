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
      }
    );

    // THEN check for existing session
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
      // Primeiro, verificar se o email já existe usando a API de administração
      const { data: existingUsers, error: checkError } = await supabase
        .rpc('check_user_exists', { email_to_check: email })
        .single();

      // Se não conseguiu verificar, prosseguir com tentativa de cadastro
      if (!checkError && existingUsers) {
        toast({
          title: "Email já cadastrado",
          description: "Este email já possui uma conta. Faça login ou use a opção 'Esqueci minha senha'.",
          variant: "destructive"
        });
        return { error: { message: "Email já registrado" } };
      }

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
            error.message.includes('already_registered')) {
          toast({
            title: "Email já cadastrado",
            description: "Este email já possui uma conta. Faça login ou use a opção 'Esqueci minha senha'.",
            variant: "destructive"
          });
        } else if (error.message.includes('Password should be at least')) {
          toast({
            title: "Senha muito fraca",
            description: "A senha deve ter pelo menos 6 caracteres.",
            variant: "destructive"
          });
        } else if (error.message.includes('Signup is disabled')) {
          toast({
            title: "Cadastro temporariamente indisponível",
            description: "Tente novamente em alguns minutos.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro no cadastro",
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
          description: "Verifique seu email para confirmar a conta e fazer login. Confira também a pasta de spam.",
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
        title: "Erro no cadastro",
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
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }

    toast({
      title: "Login realizado!",
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

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  };
}