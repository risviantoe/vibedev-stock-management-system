"use client";

import { toast } from "sonner";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import type {
  CommandReceipt,
  FefoPreview,
  ProductInventory,
} from "@/lib/domain/inventory";
import {
  formatDate,
  formatQuantity,
  reasonLabel,
} from "@/lib/domain/inventory";
import type { StockChannel, StockReason } from "@/lib/domain/stock";
import { SelectField } from "@/components/ui/select-field";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewContent,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const reasons: StockReason[] = [
  "OFFLINE_SALE",
  "BONUS",
  "PROMO",
  "SAMPLE",
  "DAMAGED",
  "EXPIRED",
];

const channels: StockChannel[] = [
  "OFFLINE",
  "SHOPEE",
  "TIKTOK",
  "INTERNAL",
];

export function ManualOutboundForm({
  products,
}: {
  products: ProductInventory[];
}) {
  const router = useRouter();
  const activeProducts = products.filter((product) => product.is_active);
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<StockReason>("OFFLINE_SALE");
  const [channel, setChannel] = useState<StockChannel>("OFFLINE");
  const [reference, setReference] = useState("");
  const [preview, setPreview] = useState<FefoPreview | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = activeProducts.find(
    (product) => product.id === productId,
  );
  const referenceRequired = ["BONUS", "PROMO", "SAMPLE"].includes(reason);
  const channelLocked =
    reason === "OFFLINE_SALE" || ["DAMAGED", "EXPIRED"].includes(reason);

  function invalidatePreview() {
    setPreview(null);
    setIdempotencyKey(null);
    setError(null);
  }

  function changeReason(nextReason: StockReason) {
    setReason(nextReason);
    if (nextReason === "OFFLINE_SALE") {
      setChannel("OFFLINE");
    } else if (nextReason === "DAMAGED" || nextReason === "EXPIRED") {
      setChannel("INTERNAL");
    } else {
      setChannel("INTERNAL");
    }
    invalidatePreview();
  }

  async function previewAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (referenceRequired && reference.trim().length < 3) {
      setError("Bonus, promo, dan sampel wajib memiliki referensi.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await postJson<FefoPreview>("/api/preview/fefo", {
        productId,
        qty: Number(qty),
      });
      setPreview(result);
      setIdempotencyKey(`ui:manual:${crypto.randomUUID()}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Alokasi FEFO belum dapat dihitung.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmOutbound() {
    if (!preview || !idempotencyKey || !preview.sufficient) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const receipt = await postJson<CommandReceipt>(
        "/api/commands/manual-outbound",
        {
          idempotencyKey,
          productId,
          qty: Number(qty),
          reason,
          channel,
          reference,
        },
      );
      toast.success("Barang keluar berhasil dicatat.", {
        description: "Membuka bukti transaksi di buku besar...",
      });
      router.push(`/ledger/${receipt.command_id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Barang keluar belum dapat dicatat.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="operational-form command-card" onSubmit={previewAllocation}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Produk"
          onChange={(value) => {
            setProductId(value);
            invalidatePreview();
          }}
          options={activeProducts.map((product) => ({
            description: `${product.onHandQty} unit tersedia secara fisik`,
            label: `${product.sku} · ${product.name}`,
            value: product.id,
          }))}
          searchable
          searchPlaceholder="Cari SKU atau nama produk"
          value={productId}
        />
        <TextInputField
          label="Kuantitas keluar"
          min={1}
          onChange={(event) => {
            setQty(event.target.value);
            invalidatePreview();
          }}
          placeholder="12"
          required
          type="number"
          value={qty}
        />
        <SelectField
          label="Alasan barang keluar"
          onChange={(value) => changeReason(value as StockReason)}
          options={reasons.map((item) => ({
            label: reasonLabel(item),
            value: item,
          }))}
          value={reason}
        />
        <SelectField
          description="Channel tercatat terpisah agar sumber transaksi mudah ditelusuri."
          disabled={channelLocked}
          label="Channel"
          onChange={(value) => {
            setChannel(value as StockChannel);
            invalidatePreview();
          }}
          options={channels.map((item) => ({ label: item, value: item }))}
          value={channel}
        />
        <TextInputField
          className="form-span-two"
          label={`Referensi ${referenceRequired ? "(wajib)" : "(opsional)"}`}
          minLength={referenceRequired ? 3 : undefined}
          onChange={(event) => {
            setReference(event.target.value);
            invalidatePreview();
          }}
          placeholder="CAMPAIGN-JUL26 / APPROVAL-018 / NOTA-001"
          required={referenceRequired}
          value={reference}
        />
      </div>

      {preview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader
            action={
              <StatusPill tone={preview.sufficient ? "success" : "danger"}>
                {preview.sufficient ? "Stok cukup" : "Stok tidak cukup"}
              </StatusPill>
            }
            eyebrow="Alokasi FEFO otomatis"
            title={selectedProduct?.name}
          />
          <ConfirmationPreviewSummary
            items={[
              { label: "Diminta", value: formatQuantity(preview.requested_qty) },
              { label: "Tersedia", value: formatQuantity(preview.available_qty) },
              ...(preview.reserved_qty
                ? [
                    {
                      label: "Dialokasikan",
                      value: formatQuantity(preview.reserved_qty),
                    },
                  ]
                : []),
              {
                label: "Batch terpakai",
                value: formatQuantity(preview.allocations.length),
              },
            ]}
          />
          <ConfirmationPreviewContent className="overflow-x-auto">
            <Table className="min-w-[44rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Urutan</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Alokasi</TableHead>
                  <TableHead>Saldo sebelum</TableHead>
                  <TableHead>Saldo sesudah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.allocations.map((allocation, index) => (
                  <TableRow key={allocation.batch_id}>
                    <TableCell>#{index + 1}</TableCell>
                    <TableCell>
                      <strong>{allocation.batch_code}</strong>
                    </TableCell>
                    <TableCell>{formatDate(allocation.expiry_date)}</TableCell>
                    <TableCell>{formatQuantity(allocation.allocated_qty)}</TableCell>
                    <TableCell>{formatQuantity(allocation.balance_before)}</TableCell>
                    <TableCell>{formatQuantity(allocation.balance_after)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ConfirmationPreviewContent>
          <ConfirmationPreviewNote>
            Database menghitung ulang dan mengunci batch ketika dikonfirmasi.
            Jika saldo berubah sebelum dikonfirmasi, transaksi dibatalkan tanpa
            mengubah sebagian stok.
          </ConfirmationPreviewNote>
        </ConfirmationPreview>
      ) : null}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="form-actions">
        {preview ? (
          <Button
            className="h-11 px-5"
            onClick={invalidatePreview}
            type="button"
            variant="outline"
          >
            Ubah input
          </Button>
        ) : null}
        {preview ? (
          <Button
            className="h-11 px-5"
            isDisabled={isLoading || !preview.sufficient}
            onClick={confirmOutbound}
            type="button"
          >
            <ButtonContent isLoading={isLoading} loadingLabel="Mencatat barang keluar…">
              Konfirmasi barang keluar
            </ButtonContent>
          </Button>
        ) : (
          <Button className="h-11 px-5" isDisabled={isLoading} type="submit">
            <ButtonContent isLoading={isLoading} loadingLabel="Memilih batch…">
              Tinjau alokasi batch
            </ButtonContent>
          </Button>
        )}
      </div>
    </form>
  );
}
