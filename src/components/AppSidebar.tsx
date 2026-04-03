import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderOpen,
  Target,
  BarChart3,
  MessageCircle,
  User,
  Shield,
  Plus,
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

const iconMap = {
  dashboard: LayoutDashboard,
  transactions: ArrowLeftRight,
  categories: FolderOpen,
  goals: Target,
  reports: BarChart3,
  whatsapp: MessageCircle,
  profile: User,
  admin: Shield,
};

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

  const sidebarItems = [
    { id: "dashboard", title: t('sidebar.dashboard', 'Dashboard'), icon: LayoutDashboard },
    { id: "transactions", title: t('sidebar.transactions', 'Transações'), icon: ArrowLeftRight },
    { id: "categories", title: t('sidebar.categories', 'Categorias'), icon: FolderOpen },
    { id: "goals", title: t('sidebar.goals', 'Metas'), icon: Target },
    { id: "reports", title: t('sidebar.reports', 'Relatórios'), icon: BarChart3 },
    { id: "whatsapp", title: t('sidebar.whatsapp', 'WhatsApp'), icon: MessageCircle },
    { id: "profile", title: t('sidebar.profile', 'Perfil'), icon: User },
  ];

  const adminItems = [
    { id: "admin", title: t('sidebar.admin', 'Admin'), icon: Shield },
  ];

  const allItems = [...sidebarItems, ...(isAdmin ? adminItems : [])];

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-[hsl(207,65%,15%)] to-[hsl(207,65%,10%)] text-sidebar-foreground">
        <div className="border-b border-sidebar-border p-4">
          <img src="/images/logo.png" alt="Dona Wilma" className="h-7 object-contain brightness-0 invert" />
        </div>
        
        <div className="flex-1 px-3 py-4">
          <div className="mb-3">
            <button
              onClick={() => onToggleForm()}
              className="w-full h-10 text-left bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold transition-all duration-200 rounded-xl flex items-center justify-start px-3 shadow-lg text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>{t('sidebar.newTransaction', 'Nova Transação')}</span>
            </button>
          </div>

          <div className="space-y-0.5">
            {allItems.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full h-10 transition-all duration-200 rounded-xl flex items-center px-3 gap-3 text-sm ${
                    isActive 
                      ? "bg-white/15 text-white font-semibold" 
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Sidebar className="border-r border-sidebar-border bg-gradient-to-b from-[hsl(207,65%,15%)] to-[hsl(207,65%,10%)]" style={{ width: open ? '220px' : '56px' }}>
      <SidebarHeader className="border-b border-sidebar-border p-3">
        {open ? (
          <img src="/images/logo.png" alt="Dona Wilma" className="h-7 object-contain brightness-0 invert" />
        ) : (
          <div className="w-8 h-8 bg-secondary/20 backdrop-blur rounded-lg flex items-center justify-center mx-auto">
            <span className="text-sm">💰</span>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="mb-3">
              <SidebarMenuButton
                onClick={onToggleForm}
                className={`w-full h-10 text-left bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold transition-all duration-200 shadow-lg rounded-xl text-sm ${
                  !open ? "justify-center px-1" : "justify-start px-3"
                }`}
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                {open && <span className="ml-2">{t('sidebar.newTransaction', 'Nova Transação')}</span>}
              </SidebarMenuButton>
            </div>

            <SidebarMenu>
              {allItems.map((item) => {
                const isActive = currentTab === item.id;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      className={`w-full h-10 transition-all duration-200 rounded-xl text-sm ${
                        isActive 
                          ? "bg-white/15 text-white font-semibold" 
                          : "text-white/70 hover:bg-white/8 hover:text-white"
                      } ${!open ? "justify-center px-1" : "justify-start px-3"}`}
                    >
                      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                      {open && <span className="ml-3">{item.title}</span>}
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
