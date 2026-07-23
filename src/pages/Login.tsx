import { LoginForm } from "@/components/auth/LoginForm";

export default function Login() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="animated-bg" />
      <div className="w-full max-w-md space-y-6 relative">
        <div className="text-center space-y-3">
          <img src="/images/logo.png" alt="Dona Wilma" className="h-12 mx-auto" />
          <p className="hand text-2xl">bem-vindo de volta, meu bem</p>
          <p className="text-muted-foreground text-sm">Sua assessora pessoal de finanças e compromissos</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
