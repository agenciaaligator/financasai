import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase client with detectSessionInUrl will auto-detect tokens from URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Auth callback session error:', sessionError);
          setError(sessionError.message);
          setTimeout(() => navigate('/'), 3000);
          return;
        }

        if (!session?.user) {
          console.log('No session found in callback, redirecting to login');
          navigate('/', { replace: true });
          return;
        }

        // Check password_set status
        const { data: profile } = await supabase
          .from('profiles')
          .select('password_set')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!profile?.password_set) {
          console.log('Password not set, redirecting to /set-password');
          navigate('/set-password', { replace: true });
          return;
        }

        // Check if user has active subscription
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('status')
          .eq('user_id', session.user.id)
          .in('status', ['active', 'trialing'])
          .maybeSingle();

        if (!sub) {
          console.log('No active subscription, redirecting to /choose-plan');
          navigate('/choose-plan', { replace: true });
        } else {
          console.log('Active subscription found, redirecting to /boas-vindas');
          navigate('/boas-vindas', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Erro ao processar autenticação');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Processando autenticação...</span>
      </div>
    </div>
  );
}
