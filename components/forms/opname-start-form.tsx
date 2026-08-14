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

export function OpnameStartForm() {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState("");
  const [commandKey, setCommandKey] = useState(
    () => `ui:opname-start:${crypto.randomUUID()}`,
  );
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
      await postJson<{ session_id: string }>(
        "/api/commands/opname/start",
        {
          idempotencyKey: commandKey,
          startedAt,
        },
      );
      toast.success("Sesi opname fisik berhasil dimulai.", {
        description: "Snapshot saldo sistem telah dicatat sebagai titik awal perhitungan.",
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Sesi opname belum dapat dimulai.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form" onSubmit={submit}>
      <DateTimeField
        description="Saldo sistem seluruh batch aktif akan dicatat sebagai titik awal perhitungan."
        includeTime
        label="Waktu mulai (opsional)"
        onChange={(value) => {
          setStartedAt(value);
          setCommandKey(`ui:opname-start:${crypto.randomUUID()}`);
          setShowPreview(false);
          setError(null);
        }}
        value={startedAt}
      />

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Mulai sesi opname" />
          <ConfirmationPreviewNote>
            Setelah sesi dimulai, perubahan stok akan membuat snapshot stale dan
            finalisasi ditolak. Selesaikan hitung fisik sebelum transaksi stok
            berikutnya.
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
          <ButtonContent isLoading={isSaving} loadingLabel="Memulai stok opname…">
            {showPreview ? "Konfirmasi mulai" : "Tinjau sesi"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
