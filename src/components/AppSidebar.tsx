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
  X,
  Calendar,
  Users
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsMaster } from "@/hooks/useIsMaster";

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
  isOwner?: boolean;
}

import { Shield } from "lucide-react";

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
    id: "agenda", 
    title: "Agenda", 
    icon: Calendar,
    description: "Compromissos e eventos"
  },
  { 
    id: "team", 
    title: "Equipe", 
    icon: Users,
    description: "Gerenciar membros da equipe"
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

const adminItems = [
  { 
    id: "admin", 
    title: "Admin", 
    icon: Shield,
    description: "Painel administrativo"
  },
];

export function AppSidebar({ 
  currentTab, 
  onTabChange, 
  showForm, 
  onToggleForm,
  isOwner = false
}: AppSidebarProps) {
  const { open } = useSidebar();
  const isMobile = useIsMobile();
  const { isMaster } = useIsMaster();

  // Para uso mobile, renderiza apenas o conteúdo sem wrapper Sidebar
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        {/* Header do mobile */}
        <div className="border-b border-sidebar-border p-4 bg-sidebar">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-sidebar-primary">FinançasAI</h2>
              <p className="text-xs text-sidebar-foreground/60">Gestão Inteligente</p>
            </div>
          </div>
        </div>
        
        {/* Conteúdo do mobile */}
        <div className="flex-1 px-3 py-4 bg-sidebar">
          {/* Botão de adicionar transação */}
          <div className="mb-4">
            <button
              onClick={() => {
                console.log('Mobile: botão nova transação clicado');
                onToggleForm();
              }}
              className="w-full h-12 text-left bg-gradient-primary hover:shadow-primary text-white hover:bg-gradient-primary transition-all duration-200 rounded-lg flex items-center justify-start px-4"
            >
              <Plus className="h-5 w-5" />
              <span className="ml-2 font-medium">Nova Transação</span>
            </button>
          </div>

          {/* Menu de navegação */}
          <div className="space-y-1">
            {[...sidebarItems.filter(item => item.id !== 'team' || isOwner), ...(isMaster ? adminItems : [])].map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    console.log('Mobile: clicou na tab', item.id);
                    onTabChange(item.id);
                  }}
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

  // Para desktop, usa o componente Sidebar completo
  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          {open && (
            <div>
              <h2 className="font-bold text-lg text-sidebar-primary">FinançasAI</h2>
              <p className="text-xs text-sidebar-foreground/60">Gestão Inteligente</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            {/* Botão de adicionar transação */}
            <div className="mb-4">
              <SidebarMenuButton
                onClick={onToggleForm}
                className={`w-full h-12 text-left bg-gradient-primary hover:shadow-primary text-white hover:bg-gradient-primary transition-all duration-200 ${
                  !open ? "justify-center px-2" : "justify-start px-4"
                }`}
              >
                <Plus className="h-5 w-5" />
                {open && <span className="ml-2 font-medium">Nova Transação</span>}
              </SidebarMenuButton>
            </div>

            <SidebarMenu>
              {[...sidebarItems.filter(item => item.id !== 'team' || isOwner), ...(isMaster ? adminItems : [])].map((item) => {
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