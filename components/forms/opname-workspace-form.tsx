"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import { DateTimeField } from "@/components/ui/date-time-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  OpnameFinalizeReceipt,
  OpnameSession,
} from "@/lib/domain/operations";

type PreviewAction = "SAVE" | "FINALIZE" | null;

export function OpnameWorkspaceForm({
  session,
}: {
  session: OpnameSession;
}) {
  const router = useRouter();
  const initialQuantities = useMemo(
    () =>
      Object.fromEntries(
        session.counts.map((count) => [
          count.batch_id,
          String(count.physical_qty ?? count.system_qty),
        ]),
      ),
    [session.counts],
  );
  const [quantities, setQuantities] =
    useState<Record<string, string>>(initialQuantities);
  const [occurredAt, setOccurredAt] = useState("");
  const [finalizeKey, setFinalizeKey] = useState(
    () => `ui:opname-finalize:${crypto.randomUUID()}`,
  );
  const [previewAction, setPreviewAction] = useState<PreviewAction>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const draftRows = session.counts.map((count) => {
    const physicalQty = Number(quantities[count.batch_id]);
    return {
      ...count,
      physicalQty,
      valid: Number.isSafeInteger(physicalQty) && physicalQty >= 0,
      variance: physicalQty - count.system_qty,
    };
  });
  const varianceRows = draftRows.filter((count) => count.variance !== 0);
  const allSaved = session.counts.every(
    (count) => count.physical_qty !== null,
  );

  function invalidate() {
    setFinalizeKey(`ui:opname-finalize:${crypto.randomUUID()}`);
    setPreviewAction(null);
    setError(null);
    setSuccess(null);
  }

  function validateDraft(): boolean {
    if (!draftRows.length) {
      setError("Sesi opname tidak mempunyai batch.");
      return false;
    }
    if (draftRows.some((count) => !count.valid)) {
      setError("Semua jumlah fisik harus berupa bilangan bulat 0 atau lebih.");
      return false;
    }
    return true;
  }

  async function saveDraft() {
    if (!validateDraft()) {
      return;
    }
    if (previewAction !== "SAVE") {
      setPreviewAction("SAVE");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await Promise.all(
        draftRows.map((count) =>
          postJson("/api/commands/opname/count", {
            sessionId: session.id,
            batchId: count.batch_id,
            physicalQty: count.physicalQty,
          }),
        ),
      );
      toast.success("Hasil hitung fisik tersimpan.", {
        description: `${draftRows.length} hitung fisik tersimpan sebagai draft.`,
      });
      setPreviewAction(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Hitungan opname belum berhasil disimpan. Masukan Anda masih ada di formulir; coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function finalize() {
    if (!allSaved) {
      setError("Simpan seluruh jumlah fisik sebelum menyelesaikan opname.");
      return;
    }
    if (previewAction !== "FINALIZE") {
      setPreviewAction("FINALIZE");
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const receipt = await postJson<OpnameFinalizeReceipt>(
        "/api/commands/opname/finalize",
        {
          idempotencyKey: finalizeKey,
          sessionId: session.id,
          occurredAt,
        },
      );
      if (receipt.outcome === "REJECTED") {
        setError(receipt.error?.message ?? "Finalisasi opname ditolak.");
        setPreviewAction(null);
        return;
      }
      toast.success("Stok opname selesai.", {
        description: `Stok opname selesai dengan ${receipt.session.variance_rows} penyesuaian.`,
      });
      setPreviewAction(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Opname belum dapat diselesaikan. Pastikan semua hitungan sudah disimpan, lalu coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="operational-form opname-workspace-form">
      <div className="mt-4">
        <Table className="min-w-[58rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Kedaluwarsa</TableHead>
              <TableHead>Saldo sistem</TableHead>
              <TableHead>Fisik</TableHead>
              <TableHead>Selisih</TableHead>
              <TableHead>Status simpan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draftRows.map((count) => (
              <TableRow key={count.batch_id}>
                <TableCell>
                  <strong>{count.product?.sku ?? "Produk"}</strong>
                  <small>{count.product?.name}</small>
                </TableCell>
                <TableCell>{count.batch?.batch_code ?? "Batch"}</TableCell>
                <TableCell>{count.batch?.expiry_date ?? "—"}</TableCell>
                <TableCell>{count.system_qty}</TableCell>
                <TableCell>
                  <Input
                    aria-label={`Hitung fisik ${count.batch?.batch_code}`}
                    className="h-10 w-36"
                    min={0}
                    onChange={(event) => {
                      setQuantities((current) => ({
                        ...current,
                        [count.batch_id]: event.target.value,
                      }));
                      invalidate();
                    }}
                    type="number"
                    value={quantities[count.batch_id]}
                  />
                </TableCell>
                <TableCell>
                  <strong
                    className={
                      count.variance > 0
                        ? "positive"
                        : count.variance < 0
                          ? "negative"
                          : ""
                    }
                  >
                    {count.variance > 0 ? "+" : ""}
                    {count.variance}
                  </strong>
                </TableCell>
                <TableCell>{count.saved_at ? "Tersimpan" : "Belum disimpan"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DateTimeField
        includeTime
        label="Waktu penyelesaian (opsional)"
        onChange={(value) => {
          setOccurredAt(value);
          invalidate();
        }}
        value={occurredAt}
      />

      {previewAction ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader
            title={
              previewAction === "SAVE"
                ? "Konfirmasi simpan hitungan"
                : "Konfirmasi penyelesaian opname"
            }
          />
          <ConfirmationPreviewSummary
            items={[
              { label: "Batch dihitung", value: draftRows.length },
              {
                label: "Tanpa selisih",
                value: draftRows.length - varianceRows.length,
              },
              { label: "Selisih", value: varianceRows.length },
              {
                label: "Perubahan riwayat stok",
                value:
                  previewAction === "SAVE"
                    ? "Tidak ada"
                    : "Saat opname diselesaikan",
              },
            ]}
          />
          <ConfirmationPreviewNote>
            {previewAction === "SAVE"
              ? "Draft dapat diedit kembali dan belum mengubah riwayat stok."
              : "Penyelesaian hanya dapat dilakukan sekali. Seluruh penyesuaian saldo akan dicatat bersama dan saldo awal terkait akan diverifikasi."}
          </ConfirmationPreviewNote>
        </ConfirmationPreview>
      ) : null}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="form-actions opname-actions">
        {previewAction ? (
          <Button
            className="h-11 px-5"
            onClick={() => setPreviewAction(null)}
            type="button"
            variant="outline"
          >
            Ubah
          </Button>
        ) : null}
        <Button
          className="h-11 px-5"
          isDisabled={isSaving}
          onClick={saveDraft}
          type="button"
          variant="outline"
        >
          <ButtonContent
            isLoading={isSaving && previewAction === "SAVE"}
            loadingLabel="Menyimpan hasil hitung…"
          >
            {previewAction === "SAVE" ? "Konfirmasi draft" : "Tinjau & simpan draft"}
          </ButtonContent>
        </Button>
        <Button
          className="h-11 px-5"
          isDisabled={isSaving || !allSaved}
          onClick={finalize}
          type="button"
        >
          <ButtonContent
            isLoading={isSaving && previewAction === "FINALIZE"}
            loadingLabel="Menyelesaikan stok opname…"
          >
            {previewAction === "FINALIZE" ? "Konfirmasi penyelesaian" : "Tinjau penyelesaian"}
          </ButtonContent>
        </Button>
      </div>
    </div>
  );
}
