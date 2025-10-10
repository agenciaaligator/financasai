import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WorkHour {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function WorkHoursSettings() {
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkHours();
  }, []);

  const fetchWorkHours = async () => {
    const { data, error } = await supabase
      .from('work_hours')
      .select('*')
      .order('day_of_week');
    
    if (!error && data) {
      setWorkHours(data);
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string, field: string, value: any) => {
    const { error } = await supabase
      .from('work_hours')
      .update({ [field]: value })
      .eq('id', id);
    
    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive"
      });
    } else {
      fetchWorkHours();
      toast({
        title: "Horário atualizado",
        description: "Configuração salva com sucesso!"
      });
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Horário de Trabalho
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Configure seus horários de trabalho para que o sistema sugira compromissos apenas dentro destes períodos.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dia</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workHours.map((wh) => (
              <TableRow key={wh.id}>
                <TableCell className="font-medium">{DAYS[wh.day_of_week]}</TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={wh.start_time}
                    onChange={(e) => handleUpdate(wh.id, 'start_time', e.target.value)}
                    disabled={!wh.is_active}
                    className="w-32"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={wh.end_time}
                    onChange={(e) => handleUpdate(wh.id, 'end_time', e.target.value)}
                    disabled={!wh.is_active}
                    className="w-32"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={wh.is_active}
                    onCheckedChange={(checked) => handleUpdate(wh.id, 'is_active', checked)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
