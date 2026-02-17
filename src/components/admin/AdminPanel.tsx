import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersManagement } from "./UsersManagement";
import { SubscriptionsManagement } from "./SubscriptionsManagement";
import { AdminStats } from "./AdminStats";
import { Shield, Users, CreditCard, BarChart3 } from "lucide-react";
import { LanguageFlagSelector } from "@/components/LanguageFlagSelector";

export function AdminPanel() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'stats';

  useEffect(() => {
    document.title = `${t('admin.title')} | Dona Wilma`;

    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMeta("description", t('admin.subtitle'));

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}/admin`);
  }, [t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-primary rounded-xl">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('admin.title')}</h1>
            <p className="text-muted-foreground">{t('admin.subtitle')}</p>
          </div>
        </div>
        <LanguageFlagSelector />
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={(tab) => setSearchParams({ tab }, { replace: true })} 
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3 gap-2">
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.stats')}</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.users')}</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">{t('admin.subscriptions')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <AdminStats />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UsersManagement />
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <SubscriptionsManagement />
        </TabsContent>

      </Tabs>
    </div>
  );
}
