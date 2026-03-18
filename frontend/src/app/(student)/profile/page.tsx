// frontend/src/app/(student)/profile/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/authStore";
import { apiClient } from "@/lib/api/client";
import { scheduleApi } from "@/lib/api/schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";
import {
  User, Clock, Calendar, Bell,
  Save, Shield,
} from "lucide-react";
import { QUERY_KEYS } from "@/lib/constants/queryKeys";

const DAYS = [
  { value: 0, label: "Seg" },
  { value: 1, label: "Ter" },
  { value: 2, label: "Qua" },
  { value: 3, label: "Qui" },
  { value: 4, label: "Sex" },
  { value: 5, label: "Sáb" },
  { value: 6, label: "Dom" },
];

const HOURS_OPTIONS = [0.5, 1, 1.5, 2, 3, 4, 5, 6];

export default function ProfilePage() {
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const avail = user?.study_availability;
  const [selectedDays, setSelectedDays] = useState<number[]>(
    avail?.days || [0, 1, 2, 3, 4]
  );
  const [hoursPerDay, setHoursPerDay] = useState(avail?.hours_per_day || 2);
  const [startTime, setStartTime] = useState(avail?.preferred_start_time || "19:00");
  const [savingAvail, setSavingAvail] = useState(false);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  // Atualiza perfil
  const updateProfile = useMutation({
    mutationFn: (data: { name: string }) =>
      apiClient.put("/auth/profile", data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ME });
      toast.success("Perfil atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSaveAvailability = async () => {
    if (selectedDays.length === 0) {
      toast.error("Selecione pelo menos um dia");
      return;
    }
    setSavingAvail(true);
    try {
      await scheduleApi.updateAvailability({
        days: selectedDays,
        hours_per_day: hoursPerDay,
        preferred_start_time: startTime,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ME });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      toast.success(
        "Disponibilidade atualizada!",
        "Seus cronogramas foram reorganizados automaticamente."
      );
    } catch {
      toast.error("Erro ao atualizar disponibilidade");
    } finally {
      setSavingAvail(false);
    }
  };

  const weeklyHours = selectedDays.length * hoursPerDay;

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Meu Perfil
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie suas informações e preferências de estudo
        </p>
      </div>

      {/* Avatar e info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-display font-bold text-primary shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-display font-semibold text-lg text-foreground">
                {user?.name}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">
                  Aluno
                </span>
                {user?.email_verified && (
                  <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Verificado
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Dados pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={handleSubmit((d) => updateProfile.mutate({ name: d.name }))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Nome completo
              </label>
              <Input {...register("name", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                E-mail
              </label>
              <Input {...register("email")} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">
                O e-mail não pode ser alterado.
              </p>
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!isDirty}
              loading={updateProfile.isPending}
            >
              <Save className="h-4 w-4" />
              Salvar alterações
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Disponibilidade de estudo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Disponibilidade de estudo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Dias da semana */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Dias disponíveis
            </p>
            <div className="flex gap-2">
              {DAYS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(value)}
                  className={cn(
                    "flex-1 h-10 rounded-lg text-xs font-semibold transition-all",
                    selectedDays.includes(value)
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Horas por dia */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Horas por dia: <span className="text-primary font-bold">{hoursPerDay}h</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {HOURS_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHoursPerDay(h)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    hoursPerDay === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary"
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          {/* Horário preferido */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Horário preferido de início
            </p>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-32"
            />
          </div>

          {/* Resumo */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-sm font-medium text-foreground">
              📅 Resumo da disponibilidade
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedDays.length} dias/semana × {hoursPerDay}h ={" "}
              <span className="font-semibold text-primary">{weeklyHours}h semanais</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Início preferido: {startTime}
            </p>
          </div>

          <Button
            onClick={handleSaveAvailability}
            loading={savingAvail}
            disabled={selectedDays.length === 0}
          >
            <Save className="h-4 w-4" />
            Salvar disponibilidade
          </Button>
        </CardContent>
      </Card>

      {/* Preferências de notificação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "email", label: "Notificações por e-mail", sub: "Lembretes de estudo e novidades" },
            { key: "push", label: "Notificações push", sub: "Alertas no navegador" },
          ].map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <button
                className="h-6 w-11 rounded-full bg-primary transition-colors relative"
              >
                <div className="h-4 w-4 rounded-full bg-white absolute right-1 top-1 shadow-sm transition-transform" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}