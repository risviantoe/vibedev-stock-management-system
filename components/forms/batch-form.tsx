"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import { formatDate } from "@/lib/domain/inventory";
import { DateTimeField } from "@/components/ui/date-time-field";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";

export function BatchForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [batchCode, setBatchCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidatePreview() {
    setShowPreview(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const savedBatchCode = batchCode.toUpperCase();
      await postJson("/api/catalog/batches", {
        productId,
        batchCode,
        expiryDate,
        sourceType: "PRODUCTION",
      });
      toast.success("Batch baru berhasil dibuat.", {
        description: `Batch ${savedBatchCode} siap menerima alokasi stok.`,
      });
      setBatchCode("");
      setExpiryDate("");
      setShowPreview(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Batch belum dapat dibuat.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          label="Kode batch"
          maxLength={100}
          onChange={(event) => {
            setBatchCode(event.target.value.toUpperCase());
            invalidatePreview();
          }}
          placeholder="SA-2026-01"
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
      </div>

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Batch produksi baru" />
          <ConfirmationPreviewSummary
            items={[
              { label: "Kode", value: batchCode },
              { label: "Kedaluwarsa", value: formatDate(expiryDate) },
              { label: "Saldo awal", value: "0 unit" },
            ]}
          />
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
          <ButtonContent isLoading={isSaving} loadingLabel="Membuat batch…">
            {showPreview ? "Konfirmasi batch" : "Tinjau batch"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
