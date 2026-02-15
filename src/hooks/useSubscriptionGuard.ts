import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionGuardState {
  loading: boolean;
  needsPassword: boolean;
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'inactive' | 'unknown';
  isInGracePeriod: boolean;
  gracePeriodEndsAt: Date | null;
  canAccessDashboard: boolean;
  subscriptionEndDate: Date | null;
  isMasterOrAdmin: boolean;
}

const GRACE_PERIOD_DAYS = 3;

export function useSubscriptionGuard(): SubscriptionGuardState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<SubscriptionGuardState>({
    loading: true,
    needsPassword: false,
    subscriptionStatus: 'unknown',
    isInGracePeriod: false,
    gracePeriodEndsAt: null,
    canAccessDashboard: false,
    subscriptionEndDate: null,
    isMasterOrAdmin: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState(prev => ({ ...prev, loading: false, canAccessDashboard: false }));
      return;
    }

    const check = async () => {
      try {
        // Check password_set from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('password_set')
          .eq('user_id', user.id)
          .maybeSingle();

        const passwordSet = profile?.password_set === true || 
          user.user_metadata?.password_set === true;

        // Check if master or admin
        const { data: isMaster } = await supabase
          .rpc('is_master_user', { _user_id: user.id });

        const { data: userRole } = await supabase
          .rpc('get_user_role', { _user_id: user.id });

        const isMasterOrAdmin = !!isMaster || userRole === 'admin';

        // Master/Admin always has access
        if (isMasterOrAdmin) {
          setState({
            loading: false,
            needsPassword: !passwordSet,
            subscriptionStatus: 'active',
            isInGracePeriod: false,
            gracePeriodEndsAt: null,
            canAccessDashboard: passwordSet,
            subscriptionEndDate: null,
            isMasterOrAdmin: true,
          });
          return;
        }

        // Check subscription
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('status, current_period_end, updated_at, cancelled_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!sub) {
          setState({
            loading: false,
            needsPassword: !passwordSet,
            subscriptionStatus: 'inactive',
            isInGracePeriod: false,
            gracePeriodEndsAt: null,
            canAccessDashboard: false,
            subscriptionEndDate: null,
            isMasterOrAdmin: false,
          });
          return;
        }

        const status = sub.status as string;
        const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
        const now = new Date();

        let subscriptionStatus: SubscriptionGuardState['subscriptionStatus'] = 'inactive';
        let isInGracePeriod = false;
        let gracePeriodEndsAt: Date | null = null;
        let canAccessDashboard = false;

        if (status === 'active') {
          subscriptionStatus = 'active';
          canAccessDashboard = passwordSet;
        } else if (status === 'past_due') {
          subscriptionStatus = 'past_due';
          const pastDueSince = new Date(sub.updated_at);
          gracePeriodEndsAt = new Date(pastDueSince.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
          isInGracePeriod = now < gracePeriodEndsAt;
          canAccessDashboard = isInGracePeriod && passwordSet;
        } else if (status === 'cancelled') {
          subscriptionStatus = 'cancelled';
          // Allow access until current_period_end
          if (currentPeriodEnd && now < currentPeriodEnd) {
            canAccessDashboard = passwordSet;
          }
        } else {
          subscriptionStatus = 'inactive';
        }

        setState({
          loading: false,
          needsPassword: !passwordSet,
          subscriptionStatus,
          isInGracePeriod,
          gracePeriodEndsAt,
          canAccessDashboard,
          subscriptionEndDate: currentPeriodEnd,
          isMasterOrAdmin: false,
        });
      } catch (error) {
        console.error('[useSubscriptionGuard] Error:', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    check();
  }, [user, authLoading]);

  return state;
}
