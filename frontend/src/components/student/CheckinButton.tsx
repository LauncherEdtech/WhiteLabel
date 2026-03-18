"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { CheckCircle2, XCircle } from "lucide-react";
interface Props { onComplete: () => void; onSkip: () => void; loading?: boolean; done?: boolean }
export function CheckinButton({ onComplete, onSkip, loading, done }: Props) {
  if (done) return <div className="flex items-center gap-2 text-success text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> Concluído!</div>;
  return (
    <div className="flex gap-3">
      <Button className="flex-1" onClick={onComplete} loading={loading}><CheckCircle2 className="h-4 w-4" /> Concluí!</Button>
      <Button variant="outline" className="flex-1" onClick={onSkip} disabled={loading}><XCircle className="h-4 w-4" /> Pular</Button>
    </div>
  );
}
