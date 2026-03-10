import { LoginForm } from "@/components/auth/LoginForm";

export default function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <img src="/images/logo.png" alt="Dona Wilma" className="h-12 mx-auto" />
          <p className="text-muted-foreground text-sm">Sua assessora pessoal de finanças e compromissos</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
