import {
  DollarSign,
  TrendingUp,
  Tags,
  BarChart,
  User,
  Plus,
  Shield,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  showForm: boolean;
  onToggleForm: () => void;
  isOwner?: boolean;
  isAdmin?: boolean;
}

export function AppSidebar({ 
  currentTab, 
  onTabChange, 
  showForm, 
  onToggleForm,
  isOwner = false,
  isAdmin: isAdminProp
}: AppSidebarProps) {
  const { open } = useSidebar();
  const isMobile = useIsMobile();
  const isAdmin = !!isAdminProp;
  const { t } = useTranslation();

  const sidebarItemsLocal = [
    { id: "dashboard", title: t('sidebar.dashboard', 'Dashboard'), icon: DollarSign, description: t('sidebar.dashboardDesc', 'Visão geral financeira') },
    { id: "transactions", title: t('sidebar.transactions', 'Transações'), icon: TrendingUp, description: t('sidebar.transactionsDesc', 'Lançamentos e movimentações') },
    { id: "categories", title: t('sidebar.categories', 'Categorias'), icon: Tags, description: t('sidebar.categoriesDesc', 'Gerenciar categorias') },
    { id: "reports", title: t('sidebar.reports', 'Relatórios'), icon: BarChart, description: t('sidebar.reportsDesc', 'Análises e gráficos') },
    { id: "profile", title: t('sidebar.profile', 'Perfil'), icon: User, description: t('sidebar.profileDesc', 'Configurações pessoais') },
  ];

  const adminItemsLocal = [
    { id: "admin", title: t('sidebar.admin', 'Admin'), icon: Shield, description: t('sidebar.adminDesc', 'Painel administrativo') },
  ];

  const allItems = [...sidebarItemsLocal, ...(isAdmin ? adminItemsLocal : [])];

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border p-4 bg-sidebar">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-sidebar-primary">Dona Wilma</h2>
              <p className="text-xs text-sidebar-foreground/60">{t('sidebar.subtitle')}</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 px-3 py-4 bg-sidebar">
          <div className="mb-4">
            <button
              onClick={() => onToggleForm()}
              className="w-full h-12 text-left bg-gradient-primary hover:shadow-primary text-white hover:bg-gradient-primary transition-all duration-200 rounded-lg flex items-center justify-start px-4"
            >
              <Plus className="h-5 w-5" />
              <span className="ml-2 font-medium">{t('sidebar.newTransaction', 'Nova Transação')}</span>
            </button>
          </div>

          <div className="space-y-1">
            {allItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full h-12 transition-all duration-200 rounded-lg flex items-center justify-start px-4 ${
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-primary font-medium border-l-4 border-primary" 
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <div className="ml-3 text-left">
                    <div className="font-medium text-sidebar-foreground">{item.title}</div>
                    {!isActive && (
                      <div className="text-xs text-sidebar-foreground/60">{item.description}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          {open && (
            <div>
              <h2 className="font-bold text-lg text-sidebar-primary">Dona Wilma</h2>
              <p className="text-xs text-sidebar-foreground/60">{t('sidebar.subtitle')}</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="mb-4">
              <SidebarMenuButton
                onClick={onToggleForm}
                className={`w-full h-12 text-left bg-gradient-primary hover:shadow-primary text-white hover:bg-gradient-primary transition-all duration-200 ${
                  !open ? "justify-center px-2" : "justify-start px-4"
                }`}
              >
                <Plus className="h-5 w-5" />
                {open && <span className="ml-2 font-medium">{t('sidebar.newTransaction', 'Nova Transação')}</span>}
              </SidebarMenuButton>
            </div>

            <SidebarMenu>
              {allItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      className={`w-full h-12 transition-all duration-200 ${
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-primary font-medium border-l-4 border-primary" 
                          : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                      } ${!open ? "justify-center px-2" : "justify-start px-4"}`}
                    >
                      <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                      {open && (
                        <div className="ml-3 text-left">
                          <div className="font-medium">{item.title}</div>
                          {!isActive && (
                            <div className="text-xs text-sidebar-foreground/60">{item.description}</div>
                          )}
                        </div>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
