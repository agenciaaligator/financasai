import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Tags,
  BarChart,
  Bot,
  Rocket,
  User,
  Plus,
  Menu,
  X
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  showForm: boolean;
  onToggleForm: () => void;
}

const sidebarItems = [
  { 
    id: "dashboard", 
    title: "Dashboard", 
    icon: DollarSign,
    description: "Visão geral financeira"
  },
  { 
    id: "transactions", 
    title: "Transações", 
    icon: TrendingUp,
    description: "Histórico de movimentações"
  },
  { 
    id: "categories", 
    title: "Categorias", 
    icon: Tags,
    description: "Gerenciar categorias"
  },
  { 
    id: "reports", 
    title: "Relatórios", 
    icon: BarChart,
    description: "Análises e gráficos"
  },
  { 
    id: "ai-chat", 
    title: "IA Reports", 
    icon: Bot,
    description: "Relatórios inteligentes"
  },
  { 
    id: "future", 
    title: "Novidades", 
    icon: Rocket,
    description: "Próximas funcionalidades"
  },
  { 
    id: "profile", 
    title: "Perfil", 
    icon: User,
    description: "Configurações pessoais"
  },
];

export function AppSidebar({ 
  currentTab, 
  onTabChange, 
  showForm, 
  onToggleForm 
}: AppSidebarProps) {
  const { open } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <Sidebar className={`border-r border-sidebar-border ${isMobile ? "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out" : ""}`}>
      <SidebarHeader className={`border-b border-sidebar-border ${isMobile ? "p-3" : "p-4"}`}>
        <div className="flex items-center gap-2">
          <div className={`${isMobile ? "w-6 h-6" : "w-8 h-8"} bg-gradient-primary rounded-lg flex items-center justify-center`}>
            <DollarSign className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} text-white`} />
          </div>
          {(open || isMobile) && (
            <div>
              <h2 className={`font-bold ${isMobile ? "text-base" : "text-lg"} text-sidebar-primary`}>FinançasAI</h2>
              <p className="text-xs text-sidebar-foreground/60">Gestão Inteligente</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className={`${isMobile ? "px-1 py-2" : "px-2 py-4"}`}>
        <SidebarGroup>
          <SidebarGroupContent>
            {/* Botão de adicionar transação */}
            <div className={`${isMobile ? "mb-2" : "mb-4"}`}>
              <SidebarMenuButton
                onClick={onToggleForm}
                className={`w-full ${isMobile ? "h-10" : "h-12"} text-left bg-gradient-primary hover:shadow-primary text-white hover:bg-gradient-primary transition-all duration-200 ${
                  !open && !isMobile ? "justify-center px-2" : "justify-start px-4"
                }`}
              >
                <Plus className={`${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
                {(open || isMobile) && <span className="ml-2 font-medium">Nova Transação</span>}
              </SidebarMenuButton>
            </div>

            <SidebarMenu>
              {sidebarItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      className={`w-full ${isMobile ? "h-10" : "h-12"} transition-all duration-200 ${
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-primary font-medium border-l-4 border-primary" 
                          : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                      } ${!open && !isMobile ? "justify-center px-2" : "justify-start px-4"}`}
                    >
                      <item.icon className={`${isMobile ? "h-4 w-4" : "h-5 w-5"} ${isActive ? "text-primary" : ""}`} />
                      {(open || isMobile) && (
                        <div className="ml-3 text-left">
                          <div className={`font-medium ${isMobile ? "text-sm" : ""}`}>{item.title}</div>
                          {!isActive && !isMobile && (
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