"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import { DateTimeField } from "@/components/ui/date-time-field";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
} from "@/components/confirmation-preview";

type ReconciliationResult = {
  as_of: string;
  detected_count: number;
  open_count: number;
};

export function ReconciliationRunForm() {
  const router = useRouter();
  const [asOf, setAsOf] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const result = await postJson<ReconciliationResult>(
        "/api/commands/reconciliation/run",
        { asOf },
      );
      toast.success("Pemeriksaan rekonsiliasi selesai.", {
        description: `${result.detected_count} perbedaan ditemukan; ${result.open_count} perlu ditindaklanjuti.`,
      });
      setShowPreview(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Rekonsiliasi belum dapat dijalankan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form" onSubmit={submit}>
      <DateTimeField
        includeTime
        label="Periksa data hingga waktu (opsional)"
        onChange={(value) => {
          setAsOf(value);
          setShowPreview(false);
          setError(null);
        }}
        value={asOf}
      />

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Yang akan diperiksa" />
          <ConfirmationPreviewNote>
            Sistem akan mencocokkan saldo dengan riwayat stok, memeriksa stok
            di bawah nol, event yang diproses ganda, pergerakan tanpa transaksi
            asal, retur berlebih, dan klaim yang terlambat. Pemeriksaan ini tidak
            mengubah saldo stok.
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
            Batal
          </Button>
        ) : null}
        <Button className="h-11 px-5" isDisabled={isSaving} type="submit">
          <ButtonContent isLoading={isSaving} loadingLabel="Memeriksa data stok…">
            {showPreview ? "Konfirmasi pemeriksaan" : "Tinjau pemeriksaan"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
