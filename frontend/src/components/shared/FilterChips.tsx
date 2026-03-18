import { cn } from "@/lib/utils/cn";
interface FilterChip { value: string; label: string }
interface Props { options: FilterChip[]; value: string; onChange: (v: string) => void; className?: string }
export function FilterChips({ options, value, onChange, className }: Props) {
  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all", value === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
