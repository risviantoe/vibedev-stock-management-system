import type { ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export type TechnicalDetailItem = {
  label: string;
  value: ReactNode;
};

export function TechnicalDetails({
  className,
  summary = "Lihat bukti teknis",
  items,
}: {
  className?: string;
  summary?: string;
  items: TechnicalDetailItem[];
}) {
  return (
    <Accordion className={cn("mt-3", className)}>
      <AccordionItem id="technical-details">
        <AccordionTrigger>{summary}</AccordionTrigger>
        <AccordionContent>
          <dl className="divide-y divide-border">
            {items.map((item) => (
              <div
                className="grid gap-1 py-2 first:pt-0 last:pb-0 sm:grid-cols-[minmax(7.5rem,0.42fr)_minmax(0,1fr)] sm:gap-3"
                key={item.label}
              >
                <dt className="min-w-0 text-sm text-current opacity-70">
                  {item.label}
                </dt>
                <dd className="min-w-0 break-words font-mono text-sm text-current">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
