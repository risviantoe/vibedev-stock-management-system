"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
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
import {
  type ReturnCondition,
  type ReturnInspectionReceipt,
  type ReturnItem,
  returnConditionLabel,
} from "@/lib/domain/operations";

function idempotencyKey() {
  return `ui:return-inspection:${crypto.randomUUID()}`;
}

function defaultBatchCode(item: ReturnItem): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `RETURN-${date}-${item.product?.sku ?? "ITEM"}-${item.id.slice(0, 4)}`
    .toUpperCase()
    .slice(0, 100);
}

export function ReturnInspectionForm({ item }: { item: ReturnItem }) {
  const router = useRouter();
  const [commandKey, setCommandKey] = useState(idempotencyKey);
  const [condition, setCondition] = useState<ReturnCondition>("SELLABLE");
  const [batchCode, setBatchCode] = useState(defaultBatchCode(item));
  const [expiryDate, setExpiryDate] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    setCommandKey(idempotencyKey());
    setShowPreview(false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (condition === "SELLABLE" && (!batchCode.trim() || !expiryDate)) {
      setError("Kode batch retur dan tanggal kedaluwarsa baru wajib diisi untuk barang layak jual.");
      return;
    }
    if (
      condition === "SELLABLE" &&
      !batchCode.trim().toUpperCase().startsWith("RETURN-")
    ) {
      setError("Kode batch retur wajib diawali RETURN-.");
      return;
    }

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const receipt = await postJson<ReturnInspectionReceipt>(
        "/api/commands/returns/inspect",
        {
          idempotencyKey: commandKey,
          returnItemId: item.id,
          condition,
          batchCode: condition === "SELLABLE" ? batchCode : "",
          expiryDate: condition === "SELLABLE" ? expiryDate : "",
          occurredAt,
        },
      );
      if (receipt.outcome === "REJECTED") {
        setError(receipt.error?.message ?? "Hasil pemeriksaan retur ditolak.");
        setShowPreview(false);
        return;
      }
      toast.success("Inspeksi retur berhasil disimpan.", {
        description:
          condition === "SELLABLE"
            ? `${item.qty} unit masuk ke batch ${batchCode}.`
            : `Barang ditandai ${returnConditionLabel(condition)} tanpa pergerakan stok kedua.`,
      });
      setShowPreview(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Hasil pemeriksaan retur belum berhasil disimpan. Masukan Anda masih ada di formulir; coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form inspection-form" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Kondisi fisik"
          onChange={(value) => {
            setCondition(value as ReturnCondition);
            invalidate();
          }}
          options={[
            { label: "Layak dijual kembali", value: "SELLABLE" },
            { label: "Rusak", value: "DAMAGED" },
            { label: "Hilang", value: "LOST" },
          ]}
          value={condition}
        />
        <TextInputField
          description="Gunakan awalan RETURN- untuk batch barang layak jual."
          disabled={condition !== "SELLABLE"}
          label="Batch retur"
          maxLength={100}
          onChange={(event) => {
            setBatchCode(event.target.value.toUpperCase());
            invalidate();
          }}
          required={condition === "SELLABLE"}
          value={batchCode}
        />
        <DateTimeField
          disabled={condition !== "SELLABLE"}
          label="Tanggal kedaluwarsa baru"
          onChange={(value) => {
            setExpiryDate(value);
            invalidate();
          }}
          required={condition === "SELLABLE"}
          value={expiryDate}
        />
        <DateTimeField
          className="form-span-two"
          includeTime
          label="Waktu inspeksi (opsional)"
          onChange={(value) => {
            setOccurredAt(value);
            invalidate();
          }}
          value={occurredAt}
        />
      </div>

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Konfirmasi hasil inspeksi" />
          <ConfirmationPreviewSummary
            items={[
              { label: "Produk", value: item.product?.sku },
              { label: "Jumlah", value: item.qty },
              { label: "Kondisi", value: returnConditionLabel(condition) },
              {
                label: "Efek stok",
                value: condition === "SELLABLE" ? `+${item.qty}` : "Tidak ada",
              },
            ]}
          />
          <ConfirmationPreviewNote>
            {condition === "SELLABLE"
              ? `Penambahan stok akan masuk ke ${batchCode}, bukan batch penjualan asal.`
              : "Stok sudah berkurang saat shipment sehingga tidak dibuat pengurangan kedua."}
          </ConfirmationPreviewNote>
        </ConfirmationPreview>
      ) : null}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="form-actions">
        {showPreview ? (
          <Button
            className="h-11 px-5"
            onClick={() => setShowPreview(false)}
            type="button"
            variant="outline"
          >
            Ubah
          </Button>
        ) : null}
        <Button className="h-11 px-5" isDisabled={isSaving} type="submit">
          <ButtonContent isLoading={isSaving} loadingLabel="Menyimpan inspeksi…">
            {showPreview ? "Konfirmasi inspeksi" : "Tinjau inspeksi"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
