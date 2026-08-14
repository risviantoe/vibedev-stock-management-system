"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Layers, Package } from "lucide-react";
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
import { formatQuantity } from "@/lib/domain/inventory";
import type { BundleConfiguration } from "@/lib/domain/marketplace";

export function BundleExpandableTable({
  bundles,
}: {
  bundles: BundleConfiguration[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(bundles.map((b) => b.id)),
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

  if (!bundles.length) {
    return (
      <EmptyState
        description="Buat susunan bundle pertama melalui formulir di atas."
        icon={<Package aria-hidden="true" />}
        title="Belum ada bundle tercatat."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-center" />
            <TableHead>SKU Bundle</TableHead>
            <TableHead>Nama Bundle</TableHead>
            <TableHead>Versi Resep</TableHead>
            <TableHead>Komponen Fisik</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bundles.map((bundle) => {
            const isExpanded = expandedIds.has(bundle.id);
            const components = bundle.activeRecipe?.components ?? [];

            return (
              <Fragment key={bundle.id}>
                <TableRow
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => toggleExpand(bundle.id)}
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
                      {bundle.sku}
                    </strong>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {bundle.name}
                  </TableCell>
                  <TableCell>
                    {bundle.activeRecipe ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <Layers className="size-3.5 text-primary" />
                        Versi {bundle.activeRecipe.version}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Belum ada susunan
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {components.length ? `${components.length} produk` : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusPill tone={bundle.is_active ? "success" : "neutral"}>
                      {bundle.is_active ? "Aktif" : "Nonaktif"}
                    </StatusPill>
                  </TableCell>
                </TableRow>

                {isExpanded ? (
                  <TableRow className="border-b bg-muted/25 hover:bg-muted/25">
                    <TableCell className="p-0" colSpan={6}>
                      <div className="border-t border-border px-6 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Rincian Komponen Fisik (Versi {bundle.activeRecipe?.version ?? "—"})
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Setiap 1 bundle mengurangi stok fisik berikut:
                          </span>
                        </div>

                        {components.length ? (
                          <div className="overflow-hidden rounded-md border border-border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableHead className="w-12 text-center text-xs">No</TableHead>
                                  <TableHead className="text-xs">SKU Produk</TableHead>
                                  <TableHead className="text-xs">Nama Produk</TableHead>
                                  <TableHead className="text-right text-xs">Kuantitas / Bundle</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {components.map((comp, index) => (
                                  <TableRow key={comp.id}>
                                    <TableCell className="text-center text-xs text-muted-foreground">
                                      {index + 1}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs font-medium text-foreground">
                                      {comp.product?.sku ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {comp.product?.name ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-foreground">
                                      {formatQuantity(comp.qty)} unit
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="py-2 text-xs italic text-muted-foreground">
                            Belum ada susunan resep yang tercatat untuk bundle ini.
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
