"use client";

import { cn } from "@/lib/utils";
import { PropsWithChildren } from "react";

export function PixelCard({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("rounded-sm pixel-card dark:pixel-card-dark p-4", className)}>
      {children}
    </div>
  );
}

export function PixelButton({ children, className, ...props }: PropsWithChildren<{ className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className={cn("font-press text-[12px] px-3 py-2 bg-black text-white border-2 border-black active:translate-y-[6px] active:shadow-none shadow-[0_6px_0_0_#111]", className)} {...props}>
      {children}
    </button>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <h2 className="font-press text-[14px] tracking-widest mb-3">{children}</h2>;
}


