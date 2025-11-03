import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Plus, Edit, Trash2, Clock, Check, RefreshCw, ArrowLeft, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { GoogleCalendarConnect } from "./dashboard/GoogleCalendarConnect";
import { GoogleCalendarOnboarding } from "./GoogleCalendarOnboarding";
import { WorkHoursSettings } from "./WorkHoursSettings";
import { useTranslation } from "react-i18next";
import { useUserRole } from "@/hooks/useUserRole";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useOrganizationPermissions } from "@/hooks/useOrganizationPermissions";

interface Commitment {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  category: "payment" | "meeting" | "appointment" | "other";
  reminder_sent: boolean;
  created_at: string;
  location?: string | null;
  participants?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  google_event_id?: string | null;
  user_id?: string; // FASE 4: Necessário para verificar permissões
}

export function CommitmentsManager() {
  console.log('📅 CommitmentsManager rendering...');
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncingFromGoogle, setSyncingFromGoogle] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
  const { toast } = useToast();
  
  // FASE 4: Bulk delete states
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Filtros
  const [titleFilter, setTitleFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  // viewScope removido - sempre visualização pessoal
  
  const { connection, loading: gcLoading, isConnected, hadConnectionBefore, connect, disconnect, syncEvent, refresh } = useGoogleCalendar();
  const { t } = useTranslation();
  const { role, isAdmin, isPremium, loading: roleLoading } = useUserRole();
  const { organization_id, role: orgRole, canViewOthers, canEditOthers, canDeleteOthers, computedScope, loading: permissionsLoading } = useOrganizationPermissions();
  
  // Verificar se tem acesso ao Google Calendar (Premium ou Admin)
  const hasGoogleCalendarAccess = isAdmin || isPremium;
  
  // Ref para scroll automático do formulário e foco no primeiro campo
  const formRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduled_at: "",
    category: "other" as "payment" | "meeting" | "appointment" | "other",
    location: "",
    participants: "",
    duration_minutes: 60,
    notes: "",
  });

  useEffect(() => {
    if (!organization_id) {
      console.log('[Agenda] Aguardando organization_id...');
      return;
    }
    fetchCommitments();
  }, [currentPage, titleFilter, dateFromFilter, dateToFilter, categoryFilter, organization_id]);

  // Refetch ao voltar focus na aba
  useEffect(() => {
    const handleFocus = () => {
      console.log('[Agenda] Tab focused - refetching commitments');
      if (organization_id) {
        fetchCommitments();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [organization_id, currentPage, titleFilter, dateFromFilter, dateToFilter, categoryFilter]);

  // CORREÇÃO [24/10/2025]: useEffect separado para evitar popup aparecer repetidamente
  useEffect(() => {
    if (gcLoading) return;
    
    const hasSeenOnboarding = localStorage.getItem('googleCalendarOnboardingSeen');
    
    // Se já teve conexão antes mas agora não está conectado, mostra banner de reconexão
    if (hadConnectionBefore && !isConnected) {
      setShowReconnectBanner(true);
      setShowOnboarding(false);
      console.log('[Agenda Debug] Onboarding vs Reconnect banner:', { 
        showModal: false, 
        showBanner: true,
        reason: 'hadConnectionBefore but disconnected'
      });
    } 
    // Se nunca teve conexão e não viu onboarding, mostra modal
    else if (!isConnected && !hasSeenOnboarding && !hadConnectionBefore) {
      setShowOnboarding(true);
      setShowReconnectBanner(false);
      console.log('[Agenda Debug] Onboarding vs Reconnect banner:', { 
        showModal: true, 
        showBanner: false,
        reason: 'first time, never connected'
      });
    }
    // Caso contrário, esconde ambos
    else {
      setShowOnboarding(false);
      setShowReconnectBanner(false);
      console.log('[Agenda Debug] Onboarding vs Reconnect banner:', { 
        showModal: false, 
        showBanner: false,
        reason: isConnected ? 'connected' : 'onboarding seen'
      });
    }
  }, [gcLoading, isConnected, hadConnectionBefore]);

  // Fechar modal quando conectar
  useEffect(() => {
    if (isConnected && showOnboarding) {
      setShowOnboarding(false);
    }
  }, [gcLoading, isConnected]);

  // Scroll automático quando o formulário abre (robusto com container)
  useLayoutEffect(() => {
    if (!showForm || !formRef.current) return;

    const log = (...args: any[]) => console.info('[Agenda] Scroll form:', ...args);

    const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
      let node = el?.parentElement;
      while (node) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const explicit = formRef.current.closest('[data-scroll-container]') as HTMLElement | null;
    const container = explicit || findScrollParent(formRef.current) || document.scrollingElement as HTMLElement;

    const isWindow = container === document.scrollingElement || container === document.documentElement || container === document.body;

    const scrollToTarget = () => {
      const el = formRef.current!;
      const elRect = el.getBoundingClientRect();
      const contRect = isWindow ? { top: 0 } as DOMRect | any : (container as HTMLElement).getBoundingClientRect();
      const currentTop = isWindow ? window.pageYOffset : (container as HTMLElement).scrollTop;

      // Offset para header sticky no mobile
      const mobileOffset = window.innerWidth < 768 ? 64 : 8;
      const targetTop = currentTop + (elRect.top - (contRect.top || 0)) - mobileOffset;

      log({ isWindow, targetTop, mobileOffset, containerTagged: explicit ? true : false });
      if (isWindow) {
        window.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
      } else {
        (container as HTMLElement).scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
      }

      // Foco no primeiro campo após um pequeno delay
      setTimeout(() => {
        try {
          titleInputRef.current?.focus();
          log('Focando campo título.');
        } catch {}
      }, 200);

      // Verificação pós-scroll
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const viewportH = isWindow ? window.innerHeight : (container as HTMLElement).clientHeight;
        log('Post-scroll check', { rectTop: rect.top, rectBottom: rect.bottom, viewportH });
      }, 350);
    };

    // rAF para garantir layout atualizado
    requestAnimationFrame(() => {
      scrollToTarget();
    });
  }, [showForm]);

  const fetchCommitments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!organization_id) {
        setLoading(true);
        return;
      }
      setLoading(true);

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      console.log('[Agenda] Fetching commitments:', {
        page: currentPage,
        filters: { titleFilter, dateFromFilter, dateToFilter, categoryFilter },
        organization: organization_id,
        canViewOthers
      });

      let query = supabase
        .from("commitments")
        .select("*", { count: 'exact' })
        .order("scheduled_at", { ascending: true });

      // ✅ SEMPRE manter filtro "gte hoje" como base
      const today = fromZonedTime(format(new Date(), 'yyyy-MM-dd') + 'T00:00:00', 'America/Sao_Paulo');
      let gteIso = today.toISOString();
      let lteIso = null;

      // ✅ Se usuário definir dateFromFilter, sobrescrever o "gte hoje"
      if (dateFromFilter) {
        const dateFrom = fromZonedTime(`${dateFromFilter}T00:00:00`, 'America/Sao_Paulo');
        gteIso = dateFrom.toISOString();
        console.log('[Agenda Debug] Date range filter from:', dateFromFilter, '→', gteIso);
      }

      if (dateToFilter) {
        const dateTo = fromZonedTime(`${dateToFilter}T23:59:59.999`, 'America/Sao_Paulo');
        lteIso = dateTo.toISOString();
        console.log('[Agenda Debug] Date range filter to:', dateToFilter, '→', lteIso);
      }

      query = query.gte("scheduled_at", gteIso);
      if (lteIso) {
        query = query.lte("scheduled_at", lteIso);
      }

      console.log('[Agenda Debug] Effective date range ISO:', { gte: gteIso, lte: lteIso });

      if (titleFilter) {
        query = query.ilike("title", `%${titleFilter}%`);
      }

      if (categoryFilter) {
        query = query.eq("category", categoryFilter);
      }

      // ✅ SEMPRE filtrar por user_id (visualização pessoal apenas)
      query = query.eq("user_id", user.id);
      
      console.log('[Agenda Debug] Scope locked to self (user_id):', user.id);

      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('[CommitmentsManager] Error loading commitments:', error);
        throw error;
      }

      const filteredData = data || [];
      console.log('[Agenda Debug] Data loaded from DB:', { count: filteredData.length });
      console.log('[Agenda Debug] Fetch completed:', { 
        page: currentPage, 
        loaded: filteredData.length,
        totalInDB: count 
      });
      
      if (filteredData.length > 0) {
        console.log('[Agenda Debug] First/Last scheduled_at:', 
          filteredData[0]?.scheduled_at, 
          filteredData[filteredData.length - 1]?.scheduled_at
        );
      }
      
      console.log('[Agenda] Loaded:', filteredData.length, 'commitments, total:', count);
      
      setCommitments(filteredData as Commitment[]);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('[CommitmentsManager] Caught error:', error);
      toast({
        title: "Erro ao carregar compromissos",
        description: error.message || "Erro desconhecido ao carregar agenda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setTitleFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setCategoryFilter("");
    setCurrentPage(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar organization_id para associar - preferir onde é owner
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id);

      const ownerMembership = memberships?.find(m => m.role === 'owner');
      const fallbackMembership = memberships?.[0];
      const orgIdToUse = ownerMembership?.organization_id || fallbackMembership?.organization_id || organization_id;

      console.log('[Agenda Debug] Selected org for saving:', { 
        ownerOrg: ownerMembership?.organization_id, 
        fallbackOrg: fallbackMembership?.organization_id, 
        finalOrgId: orgIdToUse
      });

      // Converter datetime-local (interpretado como America/Sao_Paulo) → UTC
      const brasiliaDate = fromZonedTime(formData.scheduled_at, "America/Sao_Paulo");
      const utcISO = brasiliaDate.toISOString();

      // FASE 1: VALIDAÇÃO DE HORÁRIOS DE TRABALHO (apenas para owners)
      const isMember = orgRole === 'member' || orgRole === 'viewer';
      
      if (!isMember) {
        const scheduledDate = new Date(formData.scheduled_at);
        const dayOfWeek = scheduledDate.getDay();
        const timeScheduled = format(scheduledDate, 'HH:mm');

        console.log('🔍 [Validação] Verificando horários:', {
          scheduledDate: formData.scheduled_at,
          dayOfWeek,
          timeScheduled,
          userId: user.id
        });

        // Buscar work_hours do usuário para o dia agendado
        const { data: workHours, error: workHoursError } = await supabase
          .from('work_hours')
          .select('*')
          .eq('user_id', user.id)
          .eq('day_of_week', dayOfWeek)
          .maybeSingle();

        console.log('🔍 [Validação] Work hours encontrado:', {
          workHours,
          error: workHoursError
        });

        if (workHoursError) {
          console.error('❌ [Validação] Erro ao buscar work_hours:', workHoursError);
          toast({
            title: "⚠️ Erro ao validar horários",
            description: "Não foi possível verificar seus horários de trabalho. Compromisso será criado.",
            variant: "destructive",
          });
        }

        if (!workHours && !workHoursError) {
          console.warn('⚠️ [Validação] Work hours não configurado para este dia');
          toast({
            title: "⚠️ Horários não configurados",
            description: "Configure seus horários de trabalho na aba 'Horários de Trabalho' para validações automáticas.",
            variant: "destructive",
          });
        }

        // Validação 1: Dia desabilitado
        if (workHours && workHours.is_active === false) {
          const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          console.log('⚠️ [Validação] Dia desabilitado detectado:', dayNames[dayOfWeek]);
          
          const shouldContinue = window.confirm(
            `⚠️ ATENÇÃO!\n\n${dayNames[dayOfWeek]} está DESABILITADO nos seus horários de trabalho.\n\nDeseja criar o compromisso mesmo assim?`
          );
          
          if (!shouldContinue) {
            console.log('❌ [Validação] Usuário cancelou criação - dia desabilitado');
            return;
          }
          
          console.log('✅ [Validação] Usuário confirmou criação em dia desabilitado');
          toast({
            title: "⚠️ Compromisso criado em dia desabilitado",
            description: `${dayNames[dayOfWeek]} está marcado como inativo na sua agenda.`,
            variant: "destructive",
          });
        }

        // Validação 2: Fora do horário (apenas se dia estiver ativo)
        if (workHours && workHours.is_active === true) {
          const startTime = workHours.start_time.substring(0, 5);
          const endTime = workHours.end_time.substring(0, 5);
          
          console.log('🔍 [Validação] Verificando horário:', {
            timeScheduled,
            startTime,
            endTime,
            isBeforeStart: timeScheduled < startTime,
            isAfterEnd: timeScheduled > endTime
          });
          
          if (timeScheduled < startTime || timeScheduled > endTime) {
            console.log('⚠️ [Validação] Horário fora do expediente detectado');
            
            const shouldContinue = window.confirm(
              `⏰ ATENÇÃO!\n\nO horário ${timeScheduled} está FORA do seu expediente configurado (${startTime} - ${endTime}).\n\nDeseja criar o compromisso mesmo assim?`
            );
            
            if (!shouldContinue) {
              console.log('❌ [Validação] Usuário cancelou criação - fora do horário');
              return;
            }
            
            console.log('✅ [Validação] Usuário confirmou criação fora do horário');
            toast({
              title: "⚠️ Compromisso fora do horário de trabalho",
              description: `Seu expediente é de ${startTime} às ${endTime}.`,
              variant: "destructive",
            });
          }
        }

        console.log('✅ [Validação] Validações concluídas - prosseguindo com criação');
      } else {
        console.log('ℹ️ [Validação] Membro da equipe - validação de horários desabilitada');
      }

      // Buscar reminder_settings do usuário ou usar padrão
      const { data: reminderSettings } = await supabase
        .from('reminder_settings')
        .select('default_reminders')
        .eq('user_id', user.id)
        .single();

      const defaultReminders = Array.isArray(reminderSettings?.default_reminders) 
        ? reminderSettings.default_reminders 
        : [
            { time: 1440, enabled: true }, // 24h antes
            { time: 60, enabled: true }    // 60min antes
          ];

      const scheduledReminders = defaultReminders
        .filter((r: any) => r.enabled)
        .map((r: any) => ({
          minutes_before: r.time,
          sent: false
        }));

      const dataToSave = {
        ...formData,
        scheduled_at: utcISO,
        scheduled_reminders: scheduledReminders
      };

      if (editingId) {
        // Buscar compromisso atual para verificar se mudou data/hora
        const { data: currentCommitment } = await supabase
          .from("commitments")
          .select("scheduled_at, scheduled_reminders")
          .eq("id", editingId)
          .single();

        // Se mudou a data/hora para o futuro, resetar lembretes não enviados
        let updateData = { ...dataToSave };
        if (currentCommitment && currentCommitment.scheduled_at !== utcISO) {
          const newDate = new Date(utcISO);
          const now = new Date();
          if (newDate > now) {
            // Resetar apenas os lembretes não enviados
            updateData.scheduled_reminders = scheduledReminders;
          }
        }

        const { error } = await supabase
          .from("commitments")
          .update(updateData)
          .eq("id", editingId);

        if (error) throw error;

        // Sincronizar com Google Calendar se conectado
        if (isConnected) {
          const syncResult = await syncEvent('update', editingId);
          if (!syncResult.success) {
            toast({
              title: "Compromisso atualizado",
              description: "Salvo, mas não foi possível sincronizar com Google Calendar.",
              variant: "destructive",
            });
            setFormData({
              title: "",
              description: "",
              scheduled_at: "",
              category: "other",
              location: "",
              participants: "",
              duration_minutes: 60,
              notes: "",
            });
            setEditingId(null);
            setShowForm(false);
            fetchCommitments();
            return;
          }
        }
        
        toast({
          title: t('agenda.commitmentUpdated') || "Compromisso atualizado",
          description: isConnected 
            ? t('agenda.updatedAndSynced') || "Atualizado e sincronizado com Google Calendar!" 
            : t('agenda.updatedSuccess') || "Atualizado com sucesso!",
        });
      } else {
        const { data: newCommitment, error } = await supabase
          .from("commitments")
          .insert({
            ...dataToSave,
            user_id: user.id,
            organization_id: orgIdToUse || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Sincronizar com Google Calendar se conectado
        if (isConnected && newCommitment) {
          const syncResult = await syncEvent('create', newCommitment.id);
          console.log('🔍 [CommitmentsManager] Sync result:', {
            success: syncResult.success,
            error: syncResult.error,
            commitmentId: newCommitment.id,
            title: newCommitment.title
          });
          if (!syncResult.success) {
            toast({
              title: "Compromisso criado",
              description: "Salvo, mas não foi possível sincronizar com Google Calendar.",
              variant: "destructive",
            });
            setFormData({
              title: "",
              description: "",
              scheduled_at: "",
              category: "other",
              location: "",
              participants: "",
              duration_minutes: 60,
              notes: "",
            });
            setEditingId(null);
            setShowForm(false);
            fetchCommitments();
            return;
          }
        }
        
        toast({
          title: t('agenda.commitmentCreated') || "Compromisso criado!",
          description: isConnected 
            ? t('agenda.syncedWithGoogle') || "Sincronizado com Google Calendar automaticamente!" 
            : t('agenda.tipConnectGoogle') || "💡 Dica: Conecte o Google Calendar para sincronização automática.",
        });
      }

      setFormData({
        title: "",
        description: "",
        scheduled_at: "",
        category: "other",
        location: "",
        participants: "",
        duration_minutes: 60,
        notes: "",
      });
      setEditingId(null);
      setShowForm(false);
      fetchCommitments();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar compromisso",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (commitment: Commitment) => {
    // Converter ISO UTC → datetime-local (America/Sao_Paulo)
    const brasiliaDate = toZonedTime(commitment.scheduled_at, "America/Sao_Paulo");
    const localISO = format(brasiliaDate, "yyyy-MM-dd'T'HH:mm");
    
    setFormData({
      title: commitment.title,
      description: commitment.description || "",
      scheduled_at: localISO,
      category: commitment.category,
      location: commitment.location || "",
      participants: commitment.participants || "",
      duration_minutes: commitment.duration_minutes || 60,
      notes: commitment.notes || "",
    });
    setEditingId(commitment.id);
    setShowForm(true);
  };

  // CORREÇÃO [24/10/2025]: Validar permissões antes de deletar
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar o compromisso antes de deletar para verificar permissões
      const commitment = commitments.find((c) => c.id === id);
      
      if (!commitment) {
        throw new Error('Compromisso não encontrado');
      }

      console.log('[Agenda Debug] Delete check:', { 
        isOwner: commitment.user_id === user.id, 
        canDeleteOthers,
        commitmentUserId: commitment.user_id,
        currentUserId: user.id
      });

      // Verificar permissões
      if (commitment.user_id !== user.id && !canDeleteOthers) {
        toast({
          title: 'Permissão negada',
          description: 'Você não tem permissão para deletar compromissos de outros usuários',
          variant: 'destructive',
        });
        return;
      }

      // Sincronizar com Google Calendar ANTES de deletar (apenas se for o próprio compromisso)
      const shouldSyncToGoogle = isConnected && commitment.google_event_id && commitment.user_id === user.id;
      console.log('[Agenda Debug] Sync delete to Google?', shouldSyncToGoogle, {
        isConnected,
        hasGoogleEventId: !!commitment.google_event_id,
        isOwner: commitment.user_id === user.id
      });

      if (shouldSyncToGoogle) {
        await syncEvent('delete', id);
      }

      const { error } = await supabase
        .from("commitments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: t('agenda.commitmentDeleted') || "Compromisso excluído",
        description: isConnected && commitment.user_id === user.id
          ? t('agenda.deletedFromGoogle') || "Excluído e removido do Google Calendar!" 
          : t('agenda.deletedSuccess') || "Excluído com sucesso!",
      });

      fetchCommitments();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir compromisso",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // FASE 4: Bulk delete handlers
  const handleToggleSelection = async (id: string, userId: string) => {
    // Verificar permissão antes de permitir seleção
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    
    const canSelect = userId === currentUser.id || canDeleteOthers;
    if (!canSelect) return;
    
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  const handleSelectAll = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    
    if (selectedIds.length === commitments.length) {
      setSelectedIds([]);
    } else {
      // Selecionar apenas compromissos que o usuário pode deletar
      const selectableIds = commitments
        .filter((c: any) => c.user_id === currentUser.id || canDeleteOthers)
        .map((c: any) => c.id);
      setSelectedIds(selectableIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const confirm = window.confirm(
      `🗑️ Confirmar exclusão?\n\n` +
      `${selectedIds.length} compromisso(s) serão excluídos permanentemente.\n\n` +
      `Esta ação não pode ser desfeita.`
    );
    
    if (!confirm) return;
    
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of selectedIds) {
      try {
        const { data: commitment } = await supabase
          .from('commitments')
          .select('google_event_id')
          .eq('id', id)
          .single();
        
        const { error } = await supabase
          .from('commitments')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        if (isConnected && commitment?.google_event_id) {
          await syncEvent('delete', id);
        }
        
        successCount++;
      } catch (err) {
        console.error('Erro ao deletar:', id, err);
        errorCount++;
      }
    }
    
    toast({
      title: successCount > 0 ? "✅ Compromissos excluídos" : "❌ Erro na exclusão",
      description: `${successCount} excluídos${errorCount > 0 ? `, ${errorCount} erros` : ''}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
    
    setSelectedIds([]);
    setBulkMode(false);
    fetchCommitments();
    setLoading(false);
  };

  const handleSyncToGoogle = async () => {
    setSyncingFromGoogle(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar compromissos sem google_event_id
      const { data: commitmentsToSync, error: fetchError } = await supabase
        .from('commitments')
        .select('*')
        .is('google_event_id', null)
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      if (!commitmentsToSync || commitmentsToSync.length === 0) {
        toast({
          title: "Nenhum compromisso para enviar",
          description: "Todos os seus compromissos já estão sincronizados com o Google Calendar",
        });
        setSyncingFromGoogle(false);
        return;
      }

      let synced = 0;
      let failed = 0;

      for (const commitment of commitmentsToSync) {
        const syncResult = await syncEvent('create', commitment.id);
        if (syncResult.success) {
          synced++;
        } else {
          failed++;
        }
      }

      toast({
        title: "Sincronização concluída!",
        description: `${synced} enviados com sucesso${failed > 0 ? `, ${failed} falharam` : ''}`,
      });

      fetchCommitments();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar para Google",
        description: error.message || "Erro desconhecido ao sincronizar",
        variant: "destructive",
      });
    } finally {
      setSyncingFromGoogle(false);
    }
  };

  const handleImportFromGoogle = async () => {
    setSyncingFromGoogle(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-import');
      
      // Check for 401 reconnect_required response
      if (error) {
        // Try to parse error message for reconnect_required code
        if (error.message && (error.message.includes('reconnect_required') || error.message.includes('401'))) {
          toast({
            title: "⚠️ Reconexão necessária",
            description: "Sua conexão com o Google expirou. Clique em Desconectar e depois em Conectar novamente.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Sincronização concluída!",
        description: `${data.imported || 0} novos, ${data.updated || 0} atualizados, ${data.skipped || 0} ignorados`,
      });

      console.log('[Agenda Debug] After import → refetch called');
      fetchCommitments();
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar",
        description: error.message || "Erro desconhecido ao sincronizar com Google Calendar",
        variant: "destructive",
      });
    } finally {
      setSyncingFromGoogle(false);
    }
  };


  const getCategoryBadge = (category: string) => {
    const variants = {
      payment: "bg-red-500",
      meeting: "bg-blue-500",
      appointment: "bg-green-500",
      other: "bg-gray-500",
    };
    const labels = {
      payment: "Pagamento",
      meeting: "Reunião",
      appointment: "Consulta",
      other: "Outro",
    };
    return (
      <Badge className={variants[category as keyof typeof variants]}>
        {labels[category as keyof typeof labels]}
      </Badge>
    );
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <GoogleCalendarOnboarding 
        open={showOnboarding} 
        onOpenChange={setShowOnboarding}
      />
      
      {/* Reconnect Banner */}
      {showReconnectBanner && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-100">Reconexão necessária</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Sua conexão com o Google Calendar expirou. Reconecte para sincronizar eventos.</p>
                </div>
              </div>
              <Button onClick={connect} variant="default" size="sm">
                Reconectar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs defaultValue="commitments" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="commitments">Compromissos</TabsTrigger>
          <TabsTrigger value="work-hours">Horários de Trabalho</TabsTrigger>
        </TabsList>

        <TabsContent value="commitments" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              {t('dashboard.agenda') || 'Agenda'}
            </h2>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              {showForm ? "Cancelar" : "Novo Compromisso"}
            </Button>
          </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Título</label>
              <Input
                placeholder="Buscar por título..."
                value={titleFilter}
                onChange={(e) => {
                  setTitleFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Data De</label>
              <Input
                type="date"
                value={dateFromFilter}
                onChange={(e) => {
                  setDateFromFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Data Até</label>
              <Input
                type="date"
                value={dateToFilter}
                onChange={(e) => {
                  setDateToFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <Select value={categoryFilter || "all"} onValueChange={(value) => {
                setCategoryFilter(value === "all" ? "" : value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="payment">Pagamento</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="appointment">Consulta</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(titleFilter || dateFromFilter || dateToFilter || categoryFilter) && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toggle removido - sistema simplificado para uso pessoal apenas */}

      {/* Google Calendar Integration Card */}
      {roleLoading || permissionsLoading ? (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 animate-pulse" />
              Carregando...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-16 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      ) : hasGoogleCalendarAccess ? (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {t('agenda.googleCalendarSync') || 'Sincronização Google Calendar'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t('agenda.googleCalendarDescription') || 'Seus compromissos serão automaticamente sincronizados com o Google Calendar'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <GoogleCalendarConnect />
              {isConnected && (
                <>
                  <Button 
                    onClick={async () => {
                      setSyncingFromGoogle(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('sync-all-google-calendars');
                        if (error) throw error;
                        
                        toast({
                          title: "✅ Sincronização concluída",
                          description: "Compromissos do Google Calendar atualizados com sucesso",
                        });
                        
                        // Recarregar lista após sincronização
                        await fetchCommitments();
                      } catch (err: any) {
                        console.error('Erro ao sincronizar:', err);
                        toast({
                          title: "Erro ao sincronizar",
                          description: err.message || "Não foi possível sincronizar com o Google Calendar",
                          variant: "destructive",
                        });
                      } finally {
                        setSyncingFromGoogle(false);
                      }
                    }}
                    disabled={syncingFromGoogle}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncingFromGoogle ? 'animate-spin' : ''}`} />
                    {syncingFromGoogle ? "Sincronizando..." : "Sincronizar Google agora"}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-2 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Google Calendar - Premium
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Sincronize automaticamente seus compromissos com o Google Calendar. 
              Disponível nos planos Premium e Enterprise.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="default" onClick={() => window.location.href = '/settings'}>
              Ver Planos
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <div ref={formRef} className="scroll-mt-24 md:scroll-mt-4">
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editingId ? "Editar Compromisso" : "Novo Compromisso"}</CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    title: "",
                    description: "",
                    scheduled_at: "",
                    category: "other",
                    location: "",
                    participants: "",
                    duration_minutes: 60,
                    notes: "",
                  });
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Título</label>
                <Input
                  ref={titleInputRef}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data e Hora</label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Pagamento</SelectItem>
                    <SelectItem value="meeting">Reunião</SelectItem>
                    <SelectItem value="appointment">Consulta</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.category === 'meeting' && (
                <div>
                  <label className="text-sm font-medium">Participantes</label>
                  <Input
                    value={formData.participants}
                    onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                    placeholder="Ex: João Silva, Maria Santos"
                  />
                </div>
              )}

              {(formData.category === 'meeting' || formData.category === 'appointment') && (
                <div>
                  <label className="text-sm font-medium">Local</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Rua Exemplo, 123 - Sala 45"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Duração (minutos)</label>
                <Input
                  type="number"
                  min="15"
                  step="15"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Observações</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Anotações adicionais..."
                />
              </div>

              <div className="flex gap-2">
                {editingId && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setFormData({
                        title: "",
                        description: "",
                        scheduled_at: "",
                        category: "other",
                        location: "",
                        participants: "",
                        duration_minutes: 60,
                        notes: "",
                      });
                      setEditingId(null);
                      setShowForm(false);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                )}
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      title: "",
                      description: "",
                      scheduled_at: "",
                      category: "other",
                      location: "",
                      participants: "",
                      duration_minutes: 60,
                      notes: "",
                    });
                    setEditingId(null);
                    setShowForm(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Atualizar" : "Criar"} Compromisso
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      )}

      {/* FASE 4: Bulk delete UI */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={bulkMode ? "default" : "outline"}
            onClick={() => {
              setBulkMode(!bulkMode);
              setSelectedIds([]);
            }}
          >
            {bulkMode ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancelar Seleção
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Selecionar Múltiplos
            </>
          )}
        </Button>
        
        {/* FASE 4: Botões de teste para admins/owners */}
        {(isAdmin || orgRole === 'owner') && (
          <>
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error('Usuário não autenticado');

                  console.log('[Agenda Debug] Test reminders invoke:', { user_id: user.id });

                  const { data, error } = await supabase.functions.invoke('send-commitment-reminders', {
                    body: { force: true, user_id: user.id }
                  });

                  console.log('[Agenda Debug] Response:', { data, error });

                  if (error) throw error;

                  const { deliverability, success, message_id, status, error: errorMsg, error_type, code } = data;

                  if (code === 'missing_whatsapp_secrets') {
                    toast({
                      title: "❌ Credenciais WhatsApp ausentes",
                      description: "Configure WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID nos secrets do Supabase Edge Functions.",
                      variant: "destructive",
                    });
                  } else if (deliverability === 'failed') {
                    const isTemplateError = error_type?.includes('TEMPLATE') || errorMsg?.toLowerCase().includes('template');
                    toast({
                      title: "❌ Falha no envio",
                      description: isTemplateError 
                        ? `Erro no template WhatsApp. Verifique se o template "hello_word" (pt_BR) está aprovado no Meta Business. Status: ${status || 'unknown'}`
                        : `${errorMsg || 'Não foi possível enviar'}. Status: ${status || 'unknown'}`,
                      variant: "destructive",
                    });
                  } else if (success && deliverability === 'sent_template') {
                    toast({
                      title: "✅ Mensagem enviada via template",
                      description: `ID: ${message_id || 'N/A'}. ${data.commitment?.is_synthetic ? 'Compromisso sintético criado. ' : ''}Verifique seu WhatsApp.`,
                    });
                  } else if (success && deliverability === 'sent_text') {
                    toast({
                      title: "✅ Mensagem enviada como texto",
                      description: `ID: ${message_id || 'N/A'}. ${data.commitment?.is_synthetic ? 'Compromisso sintético criado. ' : ''}Verifique seu WhatsApp.`,
                    });
                  } else {
                    toast({
                      title: "❌ Falha no envio",
                      description: errorMsg || "Não foi possível enviar o lembrete",
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  toast({
                    title: "Erro ao testar lembretes",
                    description: error.message,
                    variant: "destructive"
                  });
                }
              }}
            >
              🔔 Testar Lembretes
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error('Usuário não autenticado');

                  console.log('[Agenda Debug] Test daily agenda invoke:', { user_id: user.id });

                  const { data, error } = await supabase.functions.invoke('send-daily-agenda', {
                    body: { user_id: user.id }
                  });

                  console.log('[Agenda Debug] Response:', { data, error });

                  if (error) throw error;

                  const { deliverability, success, message_id, status, error: errorMsg, error_type, code } = data;

                  if (code === 'missing_whatsapp_secrets') {
                    toast({
                      title: "❌ Credenciais WhatsApp ausentes",
                      description: "Configure WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID nos secrets do Supabase Edge Functions.",
                      variant: "destructive",
                    });
                  } else if (deliverability === 'failed') {
                    const isTemplateError = error_type?.includes('TEMPLATE') || errorMsg?.toLowerCase().includes('template');
                    toast({
                      title: "❌ Falha no envio",
                      description: isTemplateError 
                        ? `Erro no template WhatsApp. Verifique se o template "hello_word" (pt_BR) está aprovado no Meta Business. Status: ${status || 'unknown'}`
                        : `${errorMsg || 'Não foi possível enviar'}. Status: ${status || 'unknown'}`,
                      variant: "destructive",
                    });
                  } else if (success && deliverability === 'sent_template') {
                    toast({
                      title: "✅ Agenda enviada via template",
                      description: `ID: ${message_id || 'N/A'}. Resumo diário enviado com sucesso!`,
                    });
                  } else if (success && deliverability === 'sent_text') {
                    toast({
                      title: "✅ Agenda enviada como texto",
                      description: `ID: ${message_id || 'N/A'}. Resumo diário enviado com sucesso!`,
                    });
                  } else {
                    toast({
                      title: "❌ Falha no envio",
                      description: errorMsg || "Não foi possível enviar o resumo diário",
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  toast({
                    title: "Erro ao testar agenda",
                    description: error.message,
                    variant: "destructive"
                  });
                }
              }}
            >
              📅 Testar Agenda
            </Button>
          </>
        )}
        </div>
        
        {bulkMode && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedIds.length} selecionado(s)
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedIds.length === commitments.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Selecionados
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {bulkMode && <TableHead className="w-12">Selecionar</TableHead>}
                <TableHead>Título</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={bulkMode ? 5 : 4} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Carregando compromissos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : commitments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={bulkMode ? 5 : 4} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Calendar className="h-12 w-12 text-muted-foreground/50" />
                      <div className="space-y-1">
                        <p className="text-muted-foreground font-medium">Nenhum compromisso encontrado</p>
                        <p className="text-sm text-muted-foreground/70">
                          {isConnected 
                            ? "Clique em 'Sincronizar Google agora' para importar seus eventos"
                            : "Adicione um novo compromisso ou conecte ao Google Calendar"}
                        </p>
                      </div>
                      {isConnected && (
                        <Button 
                          onClick={async () => {
                            setSyncingFromGoogle(true);
                            try {
                              const { error } = await supabase.functions.invoke('sync-all-google-calendars');
                              if (error) throw error;
                              toast({ title: "✅ Sincronização concluída" });
                              await fetchCommitments();
                            } catch (err: any) {
                              toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
                            } finally {
                              setSyncingFromGoogle(false);
                            }
                          }}
                          disabled={syncingFromGoogle}
                          variant="outline"
                          size="sm"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${syncingFromGoogle ? 'animate-spin' : ''}`} />
                          Sincronizar agora
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                commitments.map((commitment: any) => (
                  <TableRow key={commitment.id}>
                    {bulkMode && (
                      <TableCell className="w-12">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(commitment.id)}
                            onChange={async () => {
                              const { data: { user: currentUser } } = await supabase.auth.getUser();
                              if (currentUser && commitment.user_id) {
                                handleToggleSelection(commitment.id, commitment.user_id);
                              }
                            }}
                            disabled={!commitment.user_id}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{commitment.title}</div>
                          {commitment.google_event_id && (
                            <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                              <Check className="h-3 w-3" />
                              {t('agenda.synced') || 'Sincronizado'}
                            </Badge>
                          )}
                        </div>
                        {commitment.description && (
                          <div className="text-xs text-muted-foreground">{commitment.description}</div>
                        )}
                        {commitment.participants && (
                          <div className="text-xs text-blue-600 mt-1">👥 {commitment.participants}</div>
                        )}
                        {commitment.location && (
                          <div className="text-xs text-green-600 mt-1">📍 {commitment.location}</div>
                        )}
                        {commitment.duration_minutes && commitment.duration_minutes !== 60 && (
                          <div className="text-xs text-purple-600 mt-1">⏱️ {commitment.duration_minutes}min</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatInTimeZone(commitment.scheduled_at, "America/Sao_Paulo", "dd/MM/yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>{getCategoryBadge(commitment.category)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(commitment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(commitment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {totalCount > itemsPerPage && (
            <div className="p-4 border-t space-y-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => {
                        setCurrentPage(p => Math.max(1, p - 1));
                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.ceil(totalCount / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => {
                          setCurrentPage(page);
                          setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                        }}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => {
                        setCurrentPage(p => Math.min(Math.ceil(totalCount / itemsPerPage), p + 1));
                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                      }}
                      className={currentPage >= Math.ceil(totalCount / itemsPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              
              <p className="text-sm text-muted-foreground text-center">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} compromissos
              </p>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="work-hours">
          <WorkHoursSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
