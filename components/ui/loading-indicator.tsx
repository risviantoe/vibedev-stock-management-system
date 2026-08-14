import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingIndicator({
  label = "Sedang memproses",
  size = 16,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <LoaderCircle aria-hidden="true" className="shrink-0 animate-spin" size={size} />
      <span>{label}</span>
    </span>
  );
}

export function ButtonContent({
  children,
  isLoading,
  loadingLabel,
}: {
  children: ReactNode;
  isLoading: boolean;
  loadingLabel: string;
}) {
  return isLoading ? (
    <LoadingIndicator label={loadingLabel} />
  ) : (
    <>{children}</>
  );
}

export function PageLoadingState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="app-content single-column-content">
      <Card aria-busy="true" className="gap-5" role="status">
        <CardHeader>
          <CardTitle>
            <LoadingIndicator label={title} size={20} />
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent aria-hidden="true" className="grid max-w-2xl gap-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </CardContent>
      </Card>
    </div>
  );
}
