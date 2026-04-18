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
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Auth callback session error:', sessionError);
          setError(sessionError.message);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (!session?.user) {
          console.log('No session found in callback, redirecting to login');
          navigate('/login', { replace: true });
          return;
        }

        // Check if user has active subscription (with 1 retry to handle Stripe webhook race)
        const checkSub = async () => {
          const { data } = await supabase
            .from('user_subscriptions')
            .select('status')
            .eq('user_id', session.user.id)
            .in('status', ['active', 'trialing'])
            .maybeSingle();
          return data;
        };

        let sub = await checkSub();
        if (!sub) {
          // Webhook may still be processing — wait 3s and retry once
          console.log('No subscription found, retrying in 3s (webhook race)...');
          await new Promise((r) => setTimeout(r, 3000));
          sub = await checkSub();
        }

        if (!sub) {
          // Still no sub: route to /payment-success which has its own retry/refresh logic
          // (avoids sending users to /choose-plan and risking double-billing)
          console.log('No active subscription after retry, redirecting to /payment-success');
          navigate('/payment-success', { replace: true });
        } else {
          // Set flag for email confirmation banner (used by LoginForm if user goes there)
          sessionStorage.setItem('came_from_email_confirmation', 'true');
          console.log('Active subscription found, redirecting to /boas-vindas');
          navigate('/boas-vindas', { replace: true });
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Erro ao processar autenticação');
        setTimeout(() => navigate('/login'), 3000);
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
