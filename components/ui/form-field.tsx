"use client";

import type { ComponentProps, ReactNode } from "react";
import { Text, TextField } from "react-aria-components";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TextInputFieldProps = Omit<
  ComponentProps<typeof Input>,
  "className" | "disabled" | "required"
> & {
  className?: string;
  description?: ReactNode;
  disabled?: boolean;
  inputClassName?: string;
  label: ReactNode;
  required?: boolean;
};

export function TextInputField({
  className,
  description,
  disabled = false,
  inputClassName,
  label,
  required = false,
  ...inputProps
}: TextInputFieldProps) {
  return (
    <TextField
      className={cn("grid min-w-0 content-start gap-[0.42rem]", className)}
      data-slot="text-input-field"
      isDisabled={disabled}
      isRequired={required}
      validationBehavior="native"
    >
      <Label className="text-[length:var(--text-xs)] leading-[1.35] font-semibold">
        {label}
      </Label>
      <Input
        className={cn("h-[2.8rem] px-3 text-base md:text-base", inputClassName)}
        {...inputProps}
      />
      {description ? (
        <Text
          className="text-[length:var(--text-2xs)] leading-[1.45] text-muted-foreground"
          slot="description"
        >
          {description}
        </Text>
      ) : null}
    </TextField>
  );
}

type TextareaFieldProps = Omit<
  ComponentProps<typeof Textarea>,
  "className" | "disabled" | "required"
> & {
  className?: string;
  description?: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  required?: boolean;
  textareaClassName?: string;
};

export function TextareaField({
  className,
  description,
  disabled = false,
  label,
  required = false,
  textareaClassName,
  ...textareaProps
}: TextareaFieldProps) {
  return (
    <TextField
      className={cn("grid min-w-0 content-start gap-[0.42rem]", className)}
      data-slot="textarea-field"
      isDisabled={disabled}
      isRequired={required}
      validationBehavior="native"
    >
      <Label className="text-[length:var(--text-xs)] leading-[1.35] font-semibold">
        {label}
      </Label>
      <Textarea
        className={cn(
          "min-h-28 px-3 py-2.5 text-base leading-relaxed md:text-base",
          textareaClassName,
        )}
        {...textareaProps}
      />
      {description ? (
        <Text
          className="text-[length:var(--text-2xs)] leading-[1.45] text-muted-foreground"
          slot="description"
        >
          {description}
        </Text>
      ) : null}
    </TextField>
  );
}
