"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { postJson } from "@/lib/client/api";
import { formatDateTime, formatQuantity } from "@/lib/domain/inventory";
import type { DemoDatasetStatus, DemoResetResult } from "@/lib/domain/proof";

const RESET_CONFIRMATION = "RESET DEMO";

type DemoResetFormProps = {
  status: DemoDatasetStatus;
};

export function DemoResetForm({ status }: DemoResetFormProps) {
  const router = useRouter();
  const [showPreview, setShowPreview] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoResetResult | null>(null);

  async function resetDemo() {
    if (confirmation !== RESET_CONFIRMATION) {
      setError(`Ketik ${RESET_CONFIRMATION} untuk melanjutkan.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const nextResult = await postJson<DemoResetResult>("/api/demo/reset", {
        confirmation,
      });
      setResult(nextResult);
      setShowPreview(false);
      setConfirmation("");
      toast.success("Data demo berhasil di-reset.", {
        description: `Reset selesai dalam ${nextResult.duration_ms} ms. Data stok telah kembali ke kondisi awal.`,
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Data contoh belum dapat diatur ulang.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeOpen(open: boolean) {
    setShowPreview(open);
    if (open) {
      setError(null);
      setResult(null);
      return;
    }
    setConfirmation("");
    setError(null);
  }

  return (
    <div className="demo-reset">
      <div className="demo-reset-summary">
        <div>
          <span className="text-xs font-semibold tracking-widest text-primary uppercase">
            Khusus lingkungan demo
          </span>
          <h3>Kembalikan data contoh ke kondisi awal.</h3>
          <p>
            Proses ini mengganti data operasional contoh dengan data awal yang
            sama setiap kali dijalankan. Akun Admin dan konfigurasi sistem tetap
            dipertahankan.
          </p>
        </div>
        <div className="demo-reset-state">
          <span>{status.ready ? "Data siap" : "Perlu disiapkan"}</span>
          <strong>Versi {formatQuantity(status.generation)}</strong>
          <small>
            {status.last_reset_at
              ? `Reset ${formatDateTime(status.last_reset_at)}`
              : "Belum pernah di-reset"}
          </small>
        </div>
      </div>

      <div className="demo-dataset-counts">
        <div>
          <span>Produk</span>
          <strong>{formatQuantity(status.counts.products)}</strong>
        </div>
        <div>
          <span>Batch</span>
          <strong>{formatQuantity(status.counts.batches)}</strong>
        </div>
        <div>
          <span>Order</span>
          <strong>{formatQuantity(status.counts.orders)}</strong>
        </div>
        <div>
          <span>Pergerakan</span>
          <strong>{formatQuantity(status.counts.movements)}</strong>
        </div>
        <div>
          <span>Retur</span>
          <strong>{formatQuantity(status.counts.returns)}</strong>
        </div>
        <div>
          <span>Perbedaan data</span>
          <strong>{formatQuantity(status.counts.open_anomalies)}</strong>
        </div>
      </div>

      {!status.demo_mode ? (
        <FormMessage tone="error">
          Pengaturan ulang dikunci karena database ini bukan lingkungan demo.
        </FormMessage>
      ) : null}

      <AlertDialogTrigger isOpen={showPreview} onOpenChange={changeOpen}>
        <Button
          className="h-11 px-5"
          isDisabled={!status.demo_mode}
          type="button"
          variant="outline"
        >
          Atur ulang data contoh
        </Button>

        <AlertDialog className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <span className="text-xs font-semibold tracking-widest text-destructive uppercase">
              Perubahan permanen
            </span>
            <AlertDialogTitle className="text-lg font-semibold">
              Ganti seluruh data operasional contoh?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Produk, batch, order, riwayat stok, retur, opname, dan perbedaan
              data akan dibentuk ulang. Akun serta pengaturan sistem tidak dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <TextInputField
            autoComplete="off"
            label={
              <>
                Ketik <strong>{RESET_CONFIRMATION}</strong> untuk melanjutkan
              </>
            }
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError(null);
            }}
            placeholder={RESET_CONFIRMATION}
            value={confirmation}
          />

          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          <AlertDialogFooter>
            <AlertDialogCancel
              className="h-11 px-5"
              isDisabled={isSubmitting}
            >
              Batal
            </AlertDialogCancel>
            <Button
              className="h-11 px-5"
              isDisabled={
                isSubmitting ||
                confirmation !== RESET_CONFIRMATION ||
                !status.demo_mode
              }
              onPress={resetDemo}
              variant="destructive"
            >
              <ButtonContent
                isLoading={isSubmitting}
                loadingLabel="Mengatur ulang data…"
              >
                Konfirmasi pengaturan ulang
              </ButtonContent>
            </Button>
          </AlertDialogFooter>
        </AlertDialog>
      </AlertDialogTrigger>

      {result ? (
        <div className="demo-reset-success" role="status">
          <strong>Data contoh berhasil dikembalikan ke kondisi awal.</strong>
          <p>
            Versi {formatQuantity(result.generation)} ·{" "}
            {formatQuantity(result.counts.movements)} pergerakan ·{" "}
            {formatQuantity(result.counts.orders)} order.
          </p>
        </div>
      ) : null}
    </div>
  );
}
