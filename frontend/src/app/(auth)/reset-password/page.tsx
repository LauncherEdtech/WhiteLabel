"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { apiClient } from "@/lib/api/client";
import { Lock } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
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
      await apiClient.post("/auth/reset-password", { token, new_password: password });
      toast.success("Senha redefinida com sucesso!");
      router.push("/login");
    } catch {
      toast.error("Token inválido ou expirado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Nova senha</CardTitle>
          <p className="text-sm text-muted-foreground">Digite sua nova senha</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirmar senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button className="w-full" onClick={handleSubmit} loading={loading}>
            Redefinir senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
