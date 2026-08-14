import type { ComponentProps } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("gap-4 px-(--card-spacing)", className)}
      {...props}
    />
  );
}
