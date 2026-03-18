import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ErrorState({ title="Algo deu errado", message="Tente novamente.", onRetry }: { title?:string; message?:string; onRetry?:()=>void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div><p className="font-semibold text-foreground">{title}</p><p className="text-sm text-muted-foreground mt-1">{message}</p></div>
      {onRetry && <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}
