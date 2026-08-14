"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import type { BatchInventory, CommandReceipt } from "@/lib/domain/inventory";
import { formatQuantity } from "@/lib/domain/inventory";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";

export function OpeningBalanceForm({
  productId,
  batches,
}: {
  productId: string;
  batches: BatchInventory[];
}) {
  const router = useRouter();
  const eligibleBatches = batches.filter((batch) => !batch.openingBalance);
  const [batchId, setBatchId] = useState(eligibleBatches[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [reference, setReference] = useState("");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedBatchId = eligibleBatches.some((batch) => batch.id === batchId)
    ? batchId
    : (eligibleBatches[0]?.id ?? "");
  const selectedBatch = eligibleBatches.find(
    (batch) => batch.id === resolvedBatchId,
  );

  function invalidatePreview() {
    setPreviewKey(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!previewKey) {
      setPreviewKey(`ui:opening:${crypto.randomUUID()}`);
      return;
    }

    setIsSaving(true);
    try {
      const receipt = await postJson<CommandReceipt>(
        "/api/commands/opening-balance",
        {
          idempotencyKey: previewKey,
          productId,
          batchId: resolvedBatchId,
          qty: Number(qty),
          reference,
        },
      );
      toast.success("Saldo awal berhasil dicatat.", {
        description: "Membuka bukti transaksi di buku besar...",
      });
      router.push(`/ledger/${receipt.command_id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Saldo awal belum dapat dicatat.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (eligibleBatches.length === 0) {
    return (
      <div className="empty-inline">
        Semua batch sudah memiliki opening balance. Buat batch baru jika
        diperlukan.
      </div>
    );
  }

  return (
    <form className="operational-form" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Batch"
          onChange={(value) => {
            setBatchId(value);
            invalidatePreview();
          }}
          options={eligibleBatches.map((batch) => ({
            description: `Kedaluwarsa ${batch.expiry_date}`,
            label: batch.batch_code,
            value: batch.id,
          }))}
          required
          searchable
          searchPlaceholder="Cari kode batch"
          value={resolvedBatchId}
        />
        <TextInputField
          label="Kuantitas opening"
          min={1}
          onChange={(event) => {
            setQty(event.target.value);
            invalidatePreview();
          }}
          placeholder="10"
          required
          type="number"
          value={qty}
        />
        <TextInputField
          label="Referensi"
          onChange={(event) => {
            setReference(event.target.value);
            invalidatePreview();
          }}
          placeholder="OPENING-2026"
          value={reference}
        />
      </div>

      {previewKey && selectedBatch ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Pergerakan yang akan dibuat" />
          <ConfirmationPreviewSummary
            items={[
              { label: "Batch", value: selectedBatch.batch_code },
              {
                label: "Perubahan",
                value: `+${formatQuantity(Number(qty))} unit`,
              },
              { label: "Status", value: "Belum terverifikasi" },
            ]}
          />
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
            Ubah
          </Button>
        ) : null}
        <Button className="h-11 px-5" isDisabled={isSaving} type="submit">
          <ButtonContent isLoading={isSaving} loadingLabel="Mencatat saldo awal…">
            {previewKey ? "Konfirmasi saldo awal" : "Tinjau saldo awal"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
