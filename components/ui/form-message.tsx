import type { ReactNode } from "react";
import { CircleCheck, CircleX } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "error" | "success";
}) {
  const isError = tone === "error";
  const Icon = isError ? CircleX : CircleCheck;

  return (
    <Alert
      className={
        isError
          ? "border-destructive/20 bg-danger-subtle"
          : "border-success/20 bg-success-subtle text-success"
      }
      data-slot="form-message"
      role={isError ? "alert" : "status"}
      variant={isError ? "destructive" : "default"}
    >
      <Icon aria-hidden="true" />
      <AlertDescription className={isError ? undefined : "text-success/90"}>
        {children}
      </AlertDescription>
    </Alert>
  );
}
