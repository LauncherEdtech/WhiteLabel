import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
type RiskLevel = "alto"|"médio"|"baixo"|null;
const variants: Record<string,"destructive"|"warning"|"success"> = { alto:"destructive", médio:"warning", baixo:"success" };
export function StudentRiskBadge({ level }: { level: RiskLevel }) {
  if (!level || level==="baixo") return null;
  return (
    <Badge variant={variants[level]} className="flex items-center gap-1 text-xs">
      <AlertTriangle className="h-3 w-3" /> Risco {level}
    </Badge>
  );
}
