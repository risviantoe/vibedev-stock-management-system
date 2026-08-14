import type { ComponentProps, ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ConfirmationPreviewItem = {
  label: ReactNode;
  value: ReactNode;
};

export function ConfirmationPreview({
  className,
  ...props
}: ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn(
        "gap-4 border-primary/20 bg-primary/5 px-(--card-spacing) shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function ConfirmationPreviewHeader({
  action,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <CardHeader className="-mx-(--card-spacing)">
      {eyebrow ? (
        <CardDescription className="font-medium text-primary">
          {eyebrow}
        </CardDescription>
      ) : null}
      <CardTitle>{title}</CardTitle>
      {action ? <CardAction>{action}</CardAction> : null}
    </CardHeader>
  );
}

export function ConfirmationPreviewSummary({
  items,
}: {
  items: ConfirmationPreviewItem[];
}) {
  return (
    <CardContent className="-mx-(--card-spacing) grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
      {items.map((item, index) => (
        <div className="min-w-0 border-l-2 border-primary/20 pl-3" key={index}>
          <span className="block text-sm text-muted-foreground">
            {item.label}
          </span>
          <strong className="mt-1 block min-w-0 break-words text-base font-semibold text-card-foreground">
            {item.value}
          </strong>
        </div>
      ))}
    </CardContent>
  );
}

export function ConfirmationPreviewContent({
  className,
  ...props
}: ComponentProps<typeof CardContent>) {
  return (
    <CardContent
      className={cn("-mx-(--card-spacing) grid gap-3", className)}
      {...props}
    />
  );
}

export function ConfirmationPreviewNote({
  className,
  ...props
}: ComponentProps<typeof CardDescription>) {
  return (
    <CardDescription
      className={cn("text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

export function ConfirmationPreviewList({
  className,
  ...props
}: ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "-mx-(--card-spacing) divide-y divide-border border-y border-border px-(--card-spacing) text-sm [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:py-3 [&>li>strong]:font-semibold",
        className,
      )}
      {...props}
    />
  );
}
