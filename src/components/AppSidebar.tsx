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
  Calendar,
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
  isAdmin: isAdminProp,
}: AppSidebarProps) {
  const { open } = useSidebar();
  const isMobile = useIsMobile();
  const isAdmin = !!isAdminProp;
  const { t } = useTranslation();

  const sidebarItems = [
    { id: "dashboard", title: t('sidebar.dashboard', 'Painel'), icon: LayoutDashboard },
    { id: "transactions", title: t('sidebar.transactions', 'Transações'), icon: ArrowLeftRight },
    { id: "categories", title: t('sidebar.categories', 'Categorias'), icon: FolderOpen },
    { id: "goals", title: t('sidebar.goals', 'Metas'), icon: Target },
    { id: "reports", title: t('sidebar.reports', 'Relatórios'), icon: BarChart3 },
    { id: "agenda", title: t('sidebar.agenda', 'Agenda'), icon: Calendar },
    { id: "whatsapp", title: t('sidebar.whatsapp', 'WhatsApp'), icon: MessageCircle },
    { id: "profile", title: t('sidebar.profile', 'Perfil'), icon: User },
  ];

  const adminItems = [
    { id: "admin", title: t('sidebar.admin', 'Admin'), icon: Shield },
  ];

  const allItems = [...sidebarItems, ...(isAdmin ? adminItems : [])];

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        <div className="border-b border-white/10 p-4 flex items-center">
          <img src="/images/logo.png" alt="Dona Wilma" className="h-8 brightness-0 invert" />
        </div>

        <div className="flex-1 px-3 py-4">
          <div className="mb-3">
            <button
              onClick={() => onToggleForm()}
              className="w-full h-11 text-left bg-secondary hover:brightness-105 text-primary font-bold transition-all duration-200 rounded-xl flex items-center justify-start px-3 shadow-mel text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>{t('sidebar.newTransaction', 'Nova Transação')}</span>
            </button>
          </div>

          <div className="space-y-1">
            {allItems.map((item) => {
              const isActive = currentTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full h-11 transition-all duration-200 rounded-xl flex items-center px-3 gap-3 text-sm ${
                    isActive
                      ? "bg-[hsl(var(--creme))] text-primary font-semibold shadow-soft"
                      : "text-white/75 hover:bg-white/8 hover:text-white font-medium"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4">
            <span className="hand block text-lg leading-tight" style={{ color: 'hsl(var(--mel-soft))' }}>tô de olho nas suas contas 💚</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Sidebar className="border-r border-white/10 bg-sidebar" style={{ width: open ? '240px' : '64px' }}>
      <SidebarHeader className="border-b border-white/10 p-3">
        {open ? (
          <div className="flex items-center">
            <img src="/images/logo.png" alt="Dona Wilma" className="h-7 brightness-0 invert" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-primary font-heading font-bold mx-auto">W</div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="mb-3">
              <SidebarMenuButton
                onClick={onToggleForm}
                className={`w-full h-11 text-left bg-secondary hover:brightness-105 text-primary font-bold transition-all duration-200 shadow-mel rounded-xl text-sm ${
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
                      className={`w-full h-11 transition-all duration-200 rounded-xl text-sm ${
                        isActive
                          ? "bg-[hsl(var(--creme))] text-primary font-semibold shadow-soft"
                          : "text-white/75 hover:bg-white/8 hover:text-white font-medium"
                      } ${!open ? "justify-center px-1" : "justify-start px-3"}`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {open && <span className="ml-3">{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {open && (
              <div className="mt-6 mx-1 rounded-2xl bg-white/5 border border-white/10 p-3">
                <span className="hand block text-base leading-tight" style={{ color: 'hsl(var(--mel-soft))' }}>tô de olho nas suas contas 💚</span>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
