import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const GCBridge = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const targetUrl = searchParams.get('u');
    
    if (targetUrl) {
      try {
        const decodedUrl = decodeURIComponent(targetUrl);
        console.log('[GCBridge] Redirecionando para Google OAuth...');
        window.location.replace(decodedUrl);
      } catch (error) {
        console.error('[GCBridge] Erro ao decodificar URL:', error);
        setTimeout(() => {
          window.location.href = '/?google=error';
        }, 3000);
      }
    } else {
      console.error('[GCBridge] Parâmetro u ausente');
      setTimeout(() => {
        window.location.href = '/?google=error';
      }, 3000);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <h2 className="text-xl font-semibold">Conectando ao Google Calendar...</h2>
        <p className="text-muted-foreground">Aguarde enquanto você é redirecionado.</p>
      </div>
    </div>
  );
};

export default GCBridge;
