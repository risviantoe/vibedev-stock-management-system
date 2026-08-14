import type { ReactNode } from "react";

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MetricCard({
  description,
  label,
  value,
}: {
  description: ReactNode;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <Card
      className="relative gap-0 overflow-hidden shadow-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary/70"
      data-slot="metric-card"
      size="sm"
    >
      <CardHeader className="gap-2 pb-3 pt-1">
        <CardDescription className="font-medium">{label}</CardDescription>
        <CardTitle className="font-semibold tabular-nums tracking-tight group-data-[size=sm]/card:text-3xl">
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="mt-auto min-h-11 border-primary/10 bg-muted/40 py-2 text-sm text-muted-foreground">
        {description}
      </CardFooter>
    </Card>
  );
}
