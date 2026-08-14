"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Gift, Tag } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime } from "@/lib/domain/inventory";
import type { PromoConfiguration } from "@/lib/domain/marketplace";

export function PromoExpandableTable({
  promos,
}: {
  promos: PromoConfiguration[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(promos.map((p) => p.id)),
  );

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (!promos.length) {
    return (
      <EmptyState
        description="Buat aturan promo pertama melalui formulir di atas."
        icon={<Gift aria-hidden="true" />}
        title="Belum ada aturan promo tercatat."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-center" />
            <TableHead>Nama Promo</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Mulai Berlaku</TableHead>
            <TableHead>Berakhir</TableHead>
            <TableHead>Aturan Bonus</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promos.map((promo) => {
            const isExpanded = expandedIds.has(promo.id);

            return (
              <Fragment key={promo.id}>
                <TableRow
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => toggleExpand(promo.id)}
                >
                  <TableCell className="text-center">
                    {isExpanded ? (
                      <ChevronDown className="mx-auto size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mx-auto size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <strong className="font-semibold text-foreground">
                      {promo.name}
                    </strong>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      <Tag className="size-3" />
                      {promo.channel}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(promo.start_at)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(promo.end_at)}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {promo.items.length} syarat & bonus
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusPill tone={promo.is_active ? "success" : "neutral"}>
                      {promo.is_active ? "Aktif" : "Nonaktif"}
                    </StatusPill>
                  </TableCell>
                </TableRow>

                {isExpanded ? (
                  <TableRow className="border-b bg-muted/25 hover:bg-muted/25">
                    <TableCell className="p-0" colSpan={7}>
                      <div className="border-t border-border px-6 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Syarat Pembelian & Bonus Barang Gratis
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Otomatis diterapkan saat order marketplace masuk
                          </span>
                        </div>

                        {promo.items.length ? (
                          <div className="overflow-hidden rounded-md border border-border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableHead className="w-12 text-center text-xs">No</TableHead>
                                  <TableHead className="text-xs">Produk Pemicu (Syarat)</TableHead>
                                  <TableHead className="text-xs">Produk Bonus (Gratis)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {promo.items.map((item, index) => (
                                  <TableRow key={item.id}>
                                    <TableCell className="text-center text-xs text-muted-foreground">
                                      {index + 1}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <span className="font-semibold text-foreground">
                                        Beli {item.trigger_qty} unit
                                      </span>{" "}
                                      · {item.triggerProduct?.sku} ({item.triggerProduct?.name})
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      <span className="font-semibold text-primary">
                                        Bonus {item.free_qty} unit
                                      </span>{" "}
                                      · {item.freeProduct?.sku} ({item.freeProduct?.name})
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="py-2 text-xs italic text-muted-foreground">
                            Belum ada aturan bonus untuk promo ini.
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
