import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
  children: ReactNode;
}) {
  const variant = tone === "danger" ? "destructive" : tone;

  return (
    <Badge className="h-7 px-2.5 text-xs font-semibold" variant={variant}>
      {children}
    </Badge>
  );
}
