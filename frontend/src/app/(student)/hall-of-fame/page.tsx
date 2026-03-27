// frontend/src/app/(student)/hall-of-fame/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { useState, useEffect } from "react";
import { Trophy, Star, Lock, Zap, Shield, Target } from "lucide-react";

interface BadgeDef {
    key: string; name: string; icon: string; category: string;
    description: string; points: number; earned: boolean; earned_at: string | null;
}
interface RankDef { key: string; name: string; icon: string; min_points: number; }
interface HallData {
    total_points: number; badges_earned: number; badges_total: number;
    current_rank: RankDef; next_rank: RankDef | null; rank_progress_pct: number;
    badges_by_category: Record<string, BadgeDef[]>;
    recent_badges: BadgeDef[]; new_badges: BadgeDef[];
}

const RANKS = [
    { key: "recruta", name: "Recruta", icon: "🪖", min: 0 },
    { key: "soldado", name: "Soldado", icon: "🎖️", min: 100 },
    { key: "cabo", name: "Cabo", icon: "⭐", min: 300 },
    { key: "sargento", name: "Sargento", icon: "⭐⭐", min: 600 },
    { key: "tenente", name: "Tenente", icon: "⭐⭐⭐", min: 1000 },
    { key: "capitao", name: "Capitão", icon: "🔰", min: 1600 },
    { key: "major", name: "Major", icon: "🏅", min: 2500 },
    { key: "coronel", name: "Coronel", icon: "🦅", min: 4000 },
    { key: "general", name: "General", icon: "👑", min: 6000 },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
    "questões": { label: "📝 Questões", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30" },
    "acerto": { label: "🎯 Acerto", color: "from-green-500/20 to-green-600/10 border-green-500/30" },
    "aulas": { label: "🎬 Aulas", color: "from-purple-500/20 to-purple-600/10 border-purple-500/30" },
    "streak": { label: "🔥 Consistência", color: "from-orange-500/20 to-orange-600/10 border-orange-500/30" },
    "cronograma": { label: "📅 Cronograma", color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30" },
    "simulados": { label: "📋 Simulados", color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30" },
    "especiais": { label: "⭐ Especiais", color: "from-pink-500/20 to-pink-600/10 border-pink-500/30" },
};

// ── Animação de confete ao ganhar badge ───────────────────────────────────────
function NewBadgeNotification({ badges, onDismiss }: { badges: BadgeDef[]; onDismiss: () => void }) {
    useEffect(() => {
        if (badges.length > 0) {
            const t = setTimeout(onDismiss, 4000);
            return () => clearTimeout(t);
        }
    }, [badges, onDismiss]);

    if (badges.length === 0) return null;

    return (
        <div className="fixed top-6 right-6 z-50 space-y-2 max-w-xs">
            {badges.map((badge, i) => (
                <div
                    key={badge.key}
                    style={{ animationDelay: `${i * 150}ms` }}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-2xl shadow-orange-400/40 animate-bounce"
                >
                    <span className="text-3xl">{badge.icon}</span>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider opacity-80">Nova conquista!</p>
                        <p className="font-bold text-base leading-tight">{badge.name}</p>
                        <p className="text-xs opacity-80">+{badge.points} pontos</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Card de patente ───────────────────────────────────────────────────────────
function RankHeroCard({ data }: { data: HallData }) {
    const { current_rank, next_rank, rank_progress_pct, total_points } = data;
    const currentRankData = RANKS.find(r => r.key === current_rank.key) || RANKS[0];
    const currentIdx = RANKS.findIndex(r => r.key === current_rank.key);

    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8">
            {/* Decoração de fundo */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-yellow-500/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* Emblema da patente */}
                <div className="relative">
                    <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border-2 border-yellow-500/40 flex items-center justify-center text-5xl shadow-lg shadow-yellow-500/20">
                        {currentRankData.icon}
                    </div>
                    {/* Nível badge */}
                    <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-black text-xs font-black px-2 py-0.5 rounded-full">
                        Nv.{currentIdx + 1}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-yellow-400/70 mb-1">
                        Sua Patente
                    </p>
                    <h2 className="font-black text-3xl md:text-4xl text-white tracking-tight">
                        {current_rank.name}
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm">
                        <span className="text-yellow-400 font-bold text-base">{total_points.toLocaleString("pt-BR")}</span> pontos totais
                        · <span className="text-slate-300">{data.badges_earned}/{data.badges_total}</span> conquistas
                    </p>

                    {/* Barra de progresso para próxima patente */}
                    {next_rank && (
                        <div className="mt-4 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">
                                    Próxima: <span className="text-white font-semibold">{next_rank.icon} {next_rank.name}</span>
                                </span>
                                <span className="text-yellow-400 font-bold">{rank_progress_pct}%</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${rank_progress_pct}%` }}
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                {(next_rank.min_points - total_points).toLocaleString("pt-BR")} pontos para {next_rank.name}
                            </p>
                        </div>
                    )}

                    {!next_rank && (
                        <div className="mt-3 flex items-center gap-2 text-yellow-400">
                            <Trophy className="h-4 w-4" />
                            <span className="text-sm font-bold">Rank máximo! Você é um General! 👑</span>
                        </div>
                    )}
                </div>

                {/* Stats rápidos */}
                <div className="grid grid-cols-2 gap-3 shrink-0">
                    {[
                        { label: "Badges", value: data.badges_earned, icon: "🏆" },
                        { label: "Pontos", value: total_points, icon: "⚡" },
                    ].map(stat => (
                        <div key={stat.label} className="text-center p-3 rounded-xl bg-white/5 border border-white/10 min-w-[80px]">
                            <span className="text-2xl">{stat.icon}</span>
                            <p className="text-white font-black text-lg mt-0.5">{stat.value}</p>
                            <p className="text-slate-400 text-xs">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Linha de patentes */}
            <div className="relative z-10 mt-6 pt-5 border-t border-white/10">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                    {RANKS.map((rank, i) => {
                        const isReached = total_points >= rank.min;
                        const isCurrent = current_rank.key === rank.key;
                        return (
                            <div key={rank.key}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all shrink-0",
                                    isCurrent ? "bg-yellow-400/20 border border-yellow-400/40" : "opacity-50"
                                )}>
                                <span className={cn("text-lg", !isReached && "grayscale")}>{rank.icon}</span>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{rank.name}</span>
                                {isReached && !isCurrent && (
                                    <div className="h-1 w-1 rounded-full bg-green-400" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Badge individual ──────────────────────────────────────────────────────────
function BadgeItem({ badge }: { badge: BadgeDef }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 cursor-default text-center group",
                badge.earned
                    ? "bg-gradient-to-b from-white/5 to-white/0 border-white/20 hover:border-yellow-400/50 hover:bg-yellow-400/5"
                    : "bg-transparent border-white/5 grayscale opacity-30"
            )}>

            {/* Ícone */}
            <div className={cn(
                "h-14 w-14 rounded-xl flex items-center justify-center text-3xl transition-transform duration-200",
                badge.earned ? "bg-white/10" : "bg-white/5",
                badge.earned && hovered ? "scale-110" : "scale-100"
            )}>
                {badge.earned ? badge.icon : <Lock className="h-5 w-5 text-slate-600" />}
            </div>

            {/* Nome */}
            <p className={cn(
                "text-xs font-bold leading-tight",
                badge.earned ? "text-white" : "text-slate-600"
            )}>
                {badge.name}
            </p>

            {/* Descrição — tooltip style */}
            <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                {badge.description}
            </p>

            {/* Pontos */}
            {badge.earned ? (
                <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                    +{badge.points}pts
                </span>
            ) : (
                <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
                    {badge.points}pts
                </span>
            )}

            {/* Data */}
            {badge.earned && badge.earned_at && (
                <p className="text-[9px] text-slate-600 absolute top-2 right-2">
                    {new Date(badge.earned_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </p>
            )}
        </div>
    );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HallOfFamePage() {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [newBadges, setNewBadges] = useState<BadgeDef[]>([]);

    const { data, isLoading } = useQuery<HallData>({
        queryKey: ["hall-of-fame"],
        queryFn: () => apiClient.get("/gamification/hall-of-fame").then(r => r.data as HallData),
        staleTime: 30_000,
    });

    // Detecta novas badges quando data muda
    useEffect(() => {
        if (data?.new_badges && data.new_badges.length > 0) {
            setNewBadges(data.new_badges);
        }
    }, [data]);

    if (isLoading) return (
        <div className="space-y-6 max-w-3xl">
            <Skeleton className="h-56 rounded-3xl" />
            <div className="grid grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
        </div>
    );

    if (!data) return null;

    const categories = Object.keys(data.badges_by_category);
    const activeCat = activeCategory || categories[0];
    const badges = data.badges_by_category[activeCat] || [];
    const earnedInCat = badges.filter(b => b.earned).length;

    return (
        <div className="space-y-6 max-w-3xl animate-fade-in">
            <NewBadgeNotification badges={newBadges} onDismiss={() => setNewBadges([])} />

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                    <h1 className="font-black text-2xl text-foreground tracking-tight">Mural de Honra</h1>
                    <p className="text-sm text-muted-foreground">Suas conquistas e evolução</p>
                </div>
            </div>

            {/* Hero card */}
            <RankHeroCard data={data} />

            {/* Conquistas recentes */}
            {data.recent_badges.length > 0 && (
                <div>
                    <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        Recém conquistadas
                    </h2>
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        {data.recent_badges.map(badge => (
                            <div key={badge.key}
                                className="shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl bg-gradient-to-b from-yellow-400/10 to-transparent border border-yellow-400/20 w-24 text-center">
                                <span className="text-3xl">{badge.icon}</span>
                                <p className="text-[10px] font-bold text-foreground leading-tight">{badge.name}</p>
                                <span className="text-[9px] text-yellow-400">+{badge.points}pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grid de badges por categoria */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Todas as conquistas
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {data.badges_earned}/{data.badges_total} desbloqueadas
                    </span>
                </div>

                {/* Tabs de categoria */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
                    {categories.map(cat => {
                        const cfg = CATEGORY_LABELS[cat] || { label: cat, color: "" };
                        const earned = data.badges_by_category[cat].filter(b => b.earned).length;
                        const total = data.badges_by_category[cat].length;
                        const isActive = activeCat === cat;
                        return (
                            <button key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
                                    isActive
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-muted/30 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                                )}>
                                {cfg.label}
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-full",
                                    isActive ? "bg-white/20" : "bg-muted"
                                )}>
                                    {earned}/{total}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Progresso da categoria */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: badges.length > 0 ? `${(earnedInCat / badges.length) * 100}%` : "0%" }}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                        {earnedInCat}/{badges.length}
                    </span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {badges
                        .sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0))
                        .map(badge => <BadgeItem key={badge.key} badge={badge} />)
                    }
                </div>
            </div>

            {/* Tabela de patentes */}
            <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground">Tabela de Patentes</h2>
                </div>
                <div className="divide-y divide-border">
                    {RANKS.map((rank, i) => {
                        const isReached = (data.total_points) >= rank.min;
                        const isCurrent = data.current_rank.key === rank.key;
                        const nextRank = RANKS[i + 1];
                        return (
                            <div key={rank.key} className={cn(
                                "flex items-center gap-4 px-4 py-3 transition-colors",
                                isCurrent && "bg-primary/5",
                                !isReached && "opacity-40"
                            )}>
                                <span className={cn("text-2xl w-8 text-center", !isReached && "grayscale")}>{rank.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className={cn("text-sm font-bold", isCurrent ? "text-primary" : "text-foreground")}>
                                            {rank.name}
                                        </p>
                                        {isCurrent && (
                                            <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                                                Você
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {rank.min.toLocaleString("pt-BR")} pts
                                        {nextRank && ` → ${nextRank.min.toLocaleString("pt-BR")} pts`}
                                    </p>
                                </div>
                                {isReached && !isCurrent && (
                                    <span className="text-xs text-success font-medium">✓</span>
                                )}
                                {isCurrent && (
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground">{data.rank_progress_pct}%</p>
                                        <div className="w-16 h-1 bg-muted rounded-full overflow-hidden mt-1">
                                            <div className="h-full bg-primary rounded-full" style={{ width: `${data.rank_progress_pct}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}