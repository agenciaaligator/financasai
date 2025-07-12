import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) return;

    setIsLoading(true);
    
    try {
      const result = await resetPassword(email);
      
      if (result && !result.error) {
        setEmailSent(true);
        // Não fechar o modal imediatamente para mostrar a confirmação
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setEmailSent(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-primary rounded-full">
              <Mail className="h-6 w-6 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {emailSent ? 'Email Enviado!' : 'Recuperar Senha'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {emailSent 
              ? 'Enviamos um link para redefinir sua senha.'
              : 'Digite seu email para receber o link de recuperação.'
            }
          </DialogDescription>
        </DialogHeader>

        {!emailSent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:shadow-primary transition-all duration-200"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar Link de Recuperação
                  </div>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Login
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  📧 Verifique sua caixa de entrada (e spam) para o email com o link de recuperação.
                </p>
              </div>
              
              <p className="text-sm text-muted-foreground">
                O link será válido por 1 hora. Se não receber o email, tente novamente.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full"
              >
                Enviar Novamente
              </Button>
              
              <Button
                onClick={handleClose}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Login
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}