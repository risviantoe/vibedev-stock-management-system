"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Checkbox } from "react-aria-components";
import { cn } from "@/lib/utils";

export function CheckboxField({
  checked,
  className,
  description,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  className?: string;
  description?: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      className={cn(
        "group flex w-fit items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm outline-none transition-colors hover:bg-muted/40 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:ring-3 data-focus-visible:ring-ring/50",
        className,
      )}
      data-slot="checkbox-field"
      isDisabled={disabled}
      isSelected={checked}
      onChange={onChange}
    >
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-input bg-background text-primary-foreground transition-colors group-data-selected:border-primary group-data-selected:bg-primary">
        <Check
          aria-hidden="true"
          className="size-3.5 opacity-0 group-data-selected:opacity-100"
        />
      </span>
      <span className="grid min-w-0 gap-1">
        <strong className="font-semibold">{label}</strong>
        {description ? (
          <span className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </Checkbox>
  );
}

