// frontend/src/app/(auth)/reset-password/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { authApi } from "@/lib/api/auth";
import { Lock, CheckCircle2 } from "lucide-react";
import Cookies from "js-cookie";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const token = searchParams.get("token") || "";
  const tenantSlug = searchParams.get("tenant") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Garante que o cookie de tenant está setado antes de chamar a API.
  // Necessário quando o aluno acessa o link direto do e-mail em uma aba nova.
  useEffect(() => {
    if (tenantSlug) {
      Cookies.set("tenant_slug", tenantSlug, { sameSite: "lax", expires: 1 });
    }
  }, [tenantSlug]);

  const handleSubmit = async () => {
    if (!token) {
      toast.error("Link inválido", "O token de redefinição está ausente.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Token inválido ou expirado.";
      toast.error("Erro ao redefinir senha", msg);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <CardTitle>Senha redefinida!</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Sua senha foi alterada com sucesso.
            </p>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Nova senha</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Digite sua nova senha abaixo
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                Link inválido. Solicite um novo link de redefinição de senha.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nova senha</label>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!token}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Confirmar senha</label>
            <Input
              type="password"
              placeholder="Repita a nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!token}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            loading={loading}
            disabled={!token || !password || !confirm}
          >
            Redefinir senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}