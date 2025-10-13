import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, LogOut } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const GoogleCalendarConnect = () => {
  const { connection, loading, isConnected, connect, disconnect } = useGoogleCalendar();

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Verificando conexão...</span>
      </div>
    );
  }

  if (isConnected && connection) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="gap-1">
            <Calendar className="h-3 w-3" />
            Conectado
          </Badge>
          <span className="text-sm text-muted-foreground">
            {connection.calendar_email}
          </span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-fit">
              <LogOut className="h-4 w-4" />
              Desconectar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar Google Calendar?</AlertDialogTitle>
              <AlertDialogDescription>
                Seus compromissos existentes não serão deletados do Google Calendar, 
                mas novos compromissos não serão mais sincronizados automaticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={disconnect}>
                Desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Conecte sua conta Google para sincronizar automaticamente seus compromissos 
        com o Google Calendar.
      </p>
      <Button onClick={connect} className="gap-2 w-fit">
        <Calendar className="h-4 w-4" />
        Conectar Google Calendar
      </Button>
    </div>
  );
};