"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import type { CommandReceipt, ProductInventory } from "@/lib/domain/inventory";
import { formatDate, formatQuantity } from "@/lib/domain/inventory";
import { DateTimeField } from "@/components/ui/date-time-field";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";

export function InboundForm({ products }: { products: ProductInventory[] }) {
  const router = useRouter();
  const activeProducts = products.filter((product) => product.is_active);
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? "");
  const [batchCode, setBatchCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = activeProducts.find(
    (product) => product.id === productId,
  );
  const existingBatch = selectedProduct?.batches.find(
    (batch) => batch.batch_code.toUpperCase() === batchCode.trim().toUpperCase(),
  );

  function invalidatePreview() {
    setPreviewKey(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!previewKey) {
      setPreviewKey(`ui:receive:${crypto.randomUUID()}`);
      return;
    }

    setIsSaving(true);
    try {
      const receipt = await postJson<CommandReceipt>(
        "/api/commands/receive-goods",
        {
          idempotencyKey: previewKey,
          productId,
          batchCode,
          expiryDate,
          qty: Number(qty),
          reference,
        },
      );
      toast.success("Barang masuk berhasil dicatat.", {
        description: "Membuka bukti transaksi di buku besar...",
      });
      router.push(`/ledger/${receipt.command_id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Barang masuk belum dapat diposting.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form command-card" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Produk"
          onChange={(value) => {
            setProductId(value);
            invalidatePreview();
          }}
          options={activeProducts.map((product) => ({
            label: `${product.sku} · ${product.name}`,
            value: product.id,
          }))}
          searchable
          searchPlaceholder="Cari SKU atau nama produk"
          value={productId}
        />
        <TextInputField
          label="Referensi maklon"
          minLength={3}
          onChange={(event) => {
            setReference(event.target.value);
            invalidatePreview();
          }}
          placeholder="SJ-MAKLON-2026-018"
          required
          value={reference}
        />
        <TextInputField
          description={
            existingBatch
              ? "Batch sudah ada; tanggal kedaluwarsa harus sama dengan data tersimpan."
              : "Batch baru akan dibuat saat penerimaan dikonfirmasi."
          }
          label="Kode batch"
          onChange={(event) => {
            setBatchCode(event.target.value.toUpperCase());
            invalidatePreview();
          }}
          placeholder="SER-2026-08"
          required
          value={batchCode}
        />
        <DateTimeField
          label="Tanggal kedaluwarsa"
          onChange={(value) => {
            setExpiryDate(value);
            invalidatePreview();
          }}
          required
          value={expiryDate}
        />
        <TextInputField
          label="Kuantitas diterima"
          min={1}
          onChange={(event) => {
            setQty(event.target.value);
            invalidatePreview();
          }}
          placeholder="15"
          required
          type="number"
          value={qty}
        />
      </div>

      {previewKey && selectedProduct ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader
            action={
              <span className="text-3xl font-bold tracking-tight text-emerald-700">
              +{formatQuantity(Number(qty))}
              </span>
            }
            eyebrow="Preview barang masuk"
            title={selectedProduct.name}
          />
          <ConfirmationPreviewSummary
            items={[
              { label: "Batch", value: batchCode.toUpperCase() },
              { label: "Kedaluwarsa", value: formatDate(expiryDate) },
              {
                label: "Saldo batch",
                value: (
                  <>
                {formatQuantity(existingBatch?.onHandQty ?? 0)} →{" "}
                {formatQuantity(
                  (existingBatch?.onHandQty ?? 0) + Number(qty),
                )}
                  </>
                ),
              },
              { label: "Referensi", value: reference },
            ]}
          />
          <ConfirmationPreviewNote>
            Saldo final dihitung ulang oleh database saat konfirmasi.
          </ConfirmationPreviewNote>
        </ConfirmationPreview>
      ) : null}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="form-actions">
        {previewKey ? (
          <Button
            className="h-11 px-5"
            onClick={() => setPreviewKey(null)}
            type="button"
            variant="outline"
          >
            Ubah input
          </Button>
        ) : null}
        <Button className="h-11 px-5" isDisabled={isSaving} type="submit">
          <ButtonContent isLoading={isSaving} loadingLabel="Mencatat barang masuk…">
            {previewKey ? "Konfirmasi barang masuk" : "Tinjau dampak stok"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
