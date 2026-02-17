import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, DollarSign, CreditCard, UserIcon } from "lucide-react";

interface Stats {
  totalUsers: number;
  noSubscriptionUsers: number;
  premiumUsers: number;
  totalTransactions: number;
  totalRevenue: number;
}

export function AdminStats() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    noSubscriptionUsers: 0,
    premiumUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role');

      const premiumUsers = roles?.filter(r => r.role === 'premium').length || 0;
      const adminUsers = roles?.filter(r => r.role === 'admin').length || 0;
      const noSubscriptionUsers = (totalUsers || 0) - premiumUsers - adminUsers;

      const { count: totalTransactions } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });

      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('subscription_plans(price_monthly)')
        .eq('status', 'active');

      const totalRevenue = subscriptions?.reduce((acc, sub: any) => {
        return acc + (sub.subscription_plans?.price_monthly || 0);
      }, 0) || 0;

      setStats({
        totalUsers: totalUsers || 0,
        noSubscriptionUsers,
        premiumUsers,
        totalTransactions: totalTransactions || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t('admin.totalUsers'),
      value: stats.totalUsers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: t('admin.premiumUsers'),
      value: stats.premiumUsers,
      icon: CreditCard,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: t('admin.noSubscriptionUsers'),
      value: stats.noSubscriptionUsers,
      icon: UserIcon,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      title: t('admin.monthlyRevenue'),
      value: `R$ ${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-24 bg-muted/50" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-card transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.userDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Premium</span>
                <span className="font-semibold">{stats.premiumUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('admin.noSubscription')}</span>
                <span className="font-semibold">{stats.noSubscriptionUsers}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.generalSummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('admin.totalTransactions')}</span>
                <span className="font-semibold">{stats.totalTransactions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('admin.conversionRate')}</span>
                <span className="font-semibold">
                  {stats.totalUsers > 0 
                    ? ((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
