import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersManagement } from "./UsersManagement";
import { SubscriptionsManagement } from "./SubscriptionsManagement";
import { AdminStats } from "./AdminStats";
import { MessagesManagement } from "./MessagesManagement";
import { WhatsAppUsageManagement } from "./WhatsAppUsageManagement";
import { Shield, Users, CreditCard, BarChart3, Mail, MessageCircle } from "lucide-react";
import { LanguageFlagSelector } from "@/components/LanguageFlagSelector";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { buildSiteUrl } from "@/lib/siteUrl";

// Estado local em vez de ?tab= para nao conflitar com o ?tab= do FinancialDashboard
// (que sincroniza a URL com o tab da sidebar e nos jogava de volta para o dashboard).
const STORAGE_KEY = "admin_active_tab";
const VALID_TABS = ["stats", "users", "subscriptions", "whatsapp-usage", "messages"] as const;
type AdminTab = typeof VALID_TABS[number];

export function AdminPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return (VALID_TABS as readonly string[]).includes(saved || "") ? (saved as AdminTab) : "stats";
  });
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const handleTabChange = (tab: string) => {
    if ((VALID_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab as AdminTab);
      sessionStorage.setItem(STORAGE_KEY, tab);
    }
  };

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
    canonical.setAttribute("href", buildSiteUrl("/admin"));
  }, [t]);

  // Fetch new messages count + realtime
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("contact_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");
      setNewMessagesCount(count ?? 0);
    };
    fetchCount();

    const channel = supabase
      .channel("contact_messages_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, () => {
        fetchCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 md:p-3 bg-gradient-primary rounded-xl shrink-0">
            <Shield className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-bold text-foreground truncate">{t('admin.title')}</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{t('admin.subtitle')}</p>
          </div>
        </div>
        <div className="self-start sm:self-auto">
          <LanguageFlagSelector />
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        {/* Tabs com scroll horizontal no mobile, grid no desktop */}
        <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex lg:grid lg:w-full lg:grid-cols-5 gap-1 md:gap-2 px-4 sm:px-0 min-w-full lg:min-w-0">
            <TabsTrigger value="stats" className="flex items-center gap-2 whitespace-nowrap">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t('admin.stats')}</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 whitespace-nowrap">
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t('admin.users')}</span>
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2 whitespace-nowrap">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t('admin.subscriptions')}</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp-usage" className="flex items-center gap-2 whitespace-nowrap">
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2 whitespace-nowrap relative">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t('admin.messages.tab')}</span>
              {newMessagesCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                  {newMessagesCount > 99 ? "99+" : newMessagesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stats" className="space-y-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <AdminStats />
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[720px] px-4 sm:px-0 sm:min-w-0">
              <UsersManagement />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[720px] px-4 sm:px-0 sm:min-w-0">
              <SubscriptionsManagement />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp-usage" className="space-y-4">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[720px] px-4 sm:px-0 sm:min-w-0">
              <WhatsAppUsageManagement />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <MessagesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
