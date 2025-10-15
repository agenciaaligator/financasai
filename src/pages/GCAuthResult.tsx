import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GCAuthResult = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('google');
  const reason = searchParams.get('reason');

  const isSuccess = status === 'success';
  const isError = status === 'error';

  const tryClose = () => {
    try {
      window.close();
      
      setTimeout(() => {
        if (!window.closed) {
          window.location.href = '/';
        }
      }, 500);
    } catch (e) {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    if (isSuccess) {
      setTimeout(tryClose, 2000);
    }
  }, [isSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        {isSuccess && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold">Conexão realizada com sucesso!</h1>
            <p className="text-muted-foreground">
              Seu Google Calendar foi conectado. Esta janela será fechada automaticamente.
            </p>
          </>
        )}
        
        {isError && (
          <>
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Erro na conexão</h1>
            <p className="text-muted-foreground">
              Não foi possível conectar ao Google Calendar.
              {reason && ` Motivo: ${reason}`}
            </p>
          </>
        )}

        <Button onClick={tryClose} className="w-full">
          Fechar
        </Button>
      </div>
    </div>
  );
};

export default GCAuthResult;
