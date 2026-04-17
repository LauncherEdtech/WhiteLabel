// frontend/src/app/(producer)/producer/settings/notifications/page.tsx
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTenantStore } from "@/lib/stores/tenantStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { Bell, Send, CheckCircle2, ChevronLeft, Users } from "lucide-react";
import Link from "next/link";

const TEMPLATES = [
  {
    label: "Lembrete de estudo",
    text: "Não se esqueça de estudar hoje! Acesse a plataforma e mantenha sua sequência.",
  },
  {
    label: "Nova aula disponível",
    text: "Uma nova aula foi publicada. Acesse agora e continue sua preparação!",
  },
  {
    label: "Simulado disponível",
    text: "Um novo simulado está disponível para você testar seus conhecimentos!",
  },
  {
    label: "Motivacional",
    text: "Você está indo muito bem! Continue focado e sua aprovação está cada vez mais próxima.",
  },
];

const MAX_TITLE = 255;
const MAX_MESSAGE = 2000;

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const toast = useToast();
  const { tenant } = useTenantStore();

  const sendMutation = useMutation({
    mutationFn: () => {
      // Guarda: não deve ser possível chegar aqui sem tenant, mas validamos
      if (!tenant?.id) throw new Error("Tenant não identificado.");
      return apiClient
        .post(`/tenants/${tenant.id}/notify`, { title: title.trim(), message: message.trim() })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      setRecipientCount(data.recipients ?? null);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ??
        "Erro ao enviar notificação. Tente novamente.";
      toast.error(msg);
    },
  });

  // Tela de sucesso
  if (sendMutation.isSuccess) {
    return (
      <div className="max-w-lg">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-foreground">Enviado!</p>
              {recipientCount !== null && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {recipientCount}{" "}
                    {recipientCount === 1 ? "aluno recebeu" : "alunos receberão"} na plataforma
                  </p>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                sendMutation.reset();
                setTitle("");
                setMessage("");
                setRecipientCount(null);
              }}
            >
              Enviar outra mensagem
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSend =
    title.trim().length > 0 &&
    message.trim().length > 0 &&
    title.length <= MAX_TITLE &&
    message.length <= MAX_MESSAGE &&
    !!tenant?.id;

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/producer/settings">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Notificações</h1>
          <p className="text-sm text-muted-foreground">Envie mensagens para toda a turma</p>
        </div>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates rápidos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {TEMPLATES.map(({ label, text }) => (
            <button
              key={label}
              onClick={() => {
                setTitle(label);
                setMessage(text);
              }}
              className="p-3 rounded-xl border border-border text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{text}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Mensagem personalizada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Título</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Novo simulado disponível!"
              maxLength={MAX_TITLE}
            />
            <p className="text-xs text-muted-foreground text-right">
              {title.length}/{MAX_TITLE}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Mensagem</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva sua mensagem para os alunos..."
              rows={4}
              maxLength={MAX_MESSAGE}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/{MAX_MESSAGE}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
            <p className="text-xs text-warning font-medium">
              ⚠️ Esta mensagem será enviada para TODOS os alunos ativos — ela aparecerá
              na plataforma para cada aluno.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => sendMutation.mutate()}
            loading={sendMutation.isPending}
            disabled={!canSend}
          >
            <Send className="h-4 w-4" />
            Enviar para todos os alunos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}