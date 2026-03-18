"use client";
// SimuladoScoreChart — recharts component
// Implementação completa disponível quando dados estiverem conectados
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
export function SimuladoScoreChart({ data = [] }: { data?: Record<string, unknown>[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Sem dados suficientes</div>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{top:4,right:4,bottom:4,left:-20}}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{fontSize:11}} />
        <YAxis tick={{fontSize:11}} />
        <Tooltip />
        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
