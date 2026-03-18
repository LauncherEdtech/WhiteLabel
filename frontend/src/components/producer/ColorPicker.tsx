"use client";
import { PRESET_COLORS } from "@/lib/theme/defaultTheme";
import { cn } from "@/lib/utils/cn";
interface Props { value: string; onChange: (hex: string) => void }
export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="color" value={value} onChange={e=>onChange(e.target.value)} className="h-10 w-16 rounded-lg border border-border cursor-pointer" />
        <input type="text" value={value} onChange={e=>onChange(e.target.value)} className="w-28 h-10 px-3 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button key={c.hex} type="button" onClick={()=>onChange(c.hex)} title={c.name}
            className="h-8 w-8 rounded-lg border-2 transition-all hover:scale-110"
            style={{ backgroundColor:c.hex, borderColor:value===c.hex?"white":"transparent", boxShadow:value===c.hex?`0 0 0 2px ${c.hex}`:"none" }} />
        ))}
      </div>
    </div>
  );
}
