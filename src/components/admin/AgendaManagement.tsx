import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatInTimeZone } from "date-fns-tz";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Commitment {
  id: string;
  title: string;
  scheduled_at: string;
  category: string;
  google_event_id: string | null;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

const ITEMS_PER_PAGE = 10;

export function AgendaManagement() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  // Filtros
  const [titleFilter, setTitleFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");

  useEffect(() => {
    fetchCommitments();
  }, [currentPage, titleFilter, dateFromFilter, dateToFilter, responsibleFilter]);

  const fetchCommitments = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;

      let query = supabase
        .from("commitments")
        .select(`
          id,
          title,
          scheduled_at,
          category,
          google_event_id,
          user_id
        `, { count: 'exact' })
        .order("scheduled_at", { ascending: false });

      // Aplicar filtros
      if (titleFilter) {
        query = query.ilike("title", `%${titleFilter}%`);
      }
      if (dateFromFilter) {
        query = query.gte("scheduled_at", new Date(dateFromFilter).toISOString());
      }
      if (dateToFilter) {
        const dateTo = new Date(dateToFilter);
        dateTo.setHours(23, 59, 59, 999);
        query = query.lte("scheduled_at", dateTo.toISOString());
      }
      if (responsibleFilter) {
        query = query.or(`profiles.full_name.ilike.%${responsibleFilter}%,profiles.email.ilike.%${responsibleFilter}%`);
      }

      query = query.range(offset, offset + ITEMS_PER_PAGE - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      // Buscar perfis dos usuários separadamente
      const userIds = (data || []).map((c: any) => c.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // Mapear perfis para commitments
      const profilesMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, { full_name: p.full_name, email: p.email }])
      );

      const commitmentsWithProfiles = (data || []).map((c: any) => ({
        ...c,
        profiles: profilesMap.get(c.user_id)
      }));

      setCommitments(commitmentsWithProfiles as Commitment[]);
      setTotalCount(count || 0);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar compromissos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este compromisso?")) return;

    try {
      const { error } = await supabase
        .from("commitments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Compromisso excluído",
        description: "Removido com sucesso!",
      });

      fetchCommitments();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setTitleFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setResponsibleFilter("");
    setCurrentPage(1);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      payment: "Pagamento",
      meeting: "Reunião",
      appointment: "Consulta",
      other: "Outro",
    };
    return labels[category] || category;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-7 w-7" />
          Gerenciamento de Agenda
        </h2>
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
              <label className="text-sm font-medium mb-1 block">Responsável</label>
              <Input
                placeholder="Nome ou e-mail..."
                value={responsibleFilter}
                onChange={(e) => {
                  setResponsibleFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          {(titleFilter || dateFromFilter || dateToFilter || responsibleFilter) && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Compromissos */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status Sync</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commitments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum compromisso encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    commitments.map((commitment) => (
                      <TableRow key={commitment.id}>
                        <TableCell className="font-medium">{commitment.title}</TableCell>
                        <TableCell>
                          {formatInTimeZone(commitment.scheduled_at, "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(commitment.category)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {commitment.profiles?.full_name || "Sem nome"}
                            <div className="text-xs text-muted-foreground">
                              {commitment.profiles?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {commitment.google_event_id ? (
                            <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                              Sincronizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 dark:bg-gray-950">
                              Não sincronizado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(commitment.id)}
                          >
                            Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="p-4 border-t">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  <div className="text-center text-sm text-muted-foreground mt-2">
                    Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de {totalCount} compromissos
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
