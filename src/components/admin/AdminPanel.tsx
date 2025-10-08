import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersManagement } from "./UsersManagement";
import { SubscriptionsManagement } from "./SubscriptionsManagement";
import { AdminStats } from "./AdminStats";
import { CouponsManagement } from "./CouponsManagement";
import { AccessManagement } from "./AccessManagement";
import { AgendaManagement } from "./AgendaManagement";
import { Shield, Users, CreditCard, BarChart3, Tag, Key, Calendar } from "lucide-react";

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState("stats");

  useEffect(() => {
    // SEO: title, description e canonical
    document.title = "Painel Administrativo | Finanças AI";

    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    setMeta("description", "Administração do Finanças AI: gerencie usuários, assinaturas e estatísticas.");

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}/admin`);
  }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-primary rounded-xl">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie usuários, assinaturas e visualize estatísticas</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 gap-4">
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span>Estatísticas</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Assinaturas</span>
          </TabsTrigger>
          <TabsTrigger value="coupons" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span>Cupons</span>
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span>Acessos</span>
          </TabsTrigger>
          <TabsTrigger value="agenda" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Agenda</span>
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

        <TabsContent value="coupons" className="space-y-4">
          <CouponsManagement />
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <AccessManagement />
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <AgendaManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
