"use client";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-accent">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className={cn("fixed left-0 top-0 h-full w-64 bg-card border-r border-border shadow-xl", "animate-in slide-in-from-left duration-200")}>
            <div className="flex justify-end p-4">
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
