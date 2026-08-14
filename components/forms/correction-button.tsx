"use client";

import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { postJson } from "@/lib/client/api";
import {
  formatQuantity,
  reasonLabel,
  type CommandReceipt,
  type LedgerEntry,
} from "@/lib/domain/inventory";

export function CorrectionButton({ movement }: { movement: LedgerEntry }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [note, setNote] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reversalMovement =
    movement.reverses_movement_id !== null ||
    movement.reason === "ENTRY_CORRECTION" ||
    movement.reason === "CANCELLATION_REVERSAL";
  const nextBalance = movement.currentBatchBalance - movement.qty_delta;
  const canCorrect =
    !movement.isReversed && !reversalMovement && nextBalance >= 0;

  function close() {
    setIsOpen(false);
    setShowPreview(false);
    setNote("");
    setIdempotencyKey(null);
    setError(null);
  }

  function preview() {
    if (note.trim().length < 5) {
      setError("Catatan koreksi minimal 5 karakter.");
      return;
    }
    setError(null);
    setShowPreview(true);
    setIdempotencyKey(`ui:correction:${crypto.randomUUID()}`);
  }

  async function confirm() {
    if (!idempotencyKey) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const receipt = await postJson<CommandReceipt>(
        "/api/commands/correct-movement",
        {
          idempotencyKey,
          movementId: movement.id,
          note,
        },
      );
      toast.success("Koreksi riwayat stok berhasil dicatat.", {
        description: "Membuka bukti transaksi di buku besar...",
      });
      close();
      router.push(`/ledger/${receipt.command_id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Riwayat stok belum dapat dikoreksi. Coba lagi atau periksa transaksi asal.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!canCorrect) {
    return (
      <span className="table-muted">
        {movement.isReversed || reversalMovement
          ? "Sudah final"
          : "Saldo tak cukup"}
      </span>
    );
  }

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setIsOpen(true);
        } else {
          close();
        }
      }}
    >
      <Button className="h-8 px-0" type="button" variant="link">
        Koreksi
      </Button>

      <Dialog className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Koreksi pergerakan #{movement.sequence_no}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-border bg-muted/35 p-4 sm:grid-cols-3">
          <div>
            <span className="block text-xs text-muted-foreground">Produk</span>
            <strong className="mt-1 block">{movement.product?.sku}</strong>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">Batch</span>
            <strong className="mt-1 block">{movement.batch?.batch_code}</strong>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">
              Perubahan asal
            </span>
            <strong className="mt-1 block">
              {movement.qty_delta > 0 ? "+" : ""}
              {formatQuantity(movement.qty_delta)} · {reasonLabel(movement.reason)}
            </strong>
          </div>
        </div>

        {!showPreview ? (
          <TextareaField
            autoFocus
            label="Alasan koreksi"
            maxLength={280}
            onChange={(event) => {
              setNote(event.target.value);
              setError(null);
            }}
            placeholder="Contoh: Kuantitas barang masuk salah dicatat"
            rows={4}
            value={note}
          />
        ) : (
          <ConfirmationPreview>
            <ConfirmationPreviewHeader title="Catatan koreksi yang akan dibuat" />
            <ConfirmationPreviewSummary
              items={[
                {
                  label: "Perubahan pembalik",
                  value: (
                    <>
                  {movement.qty_delta < 0 ? "+" : "−"}
                  {formatQuantity(Math.abs(movement.qty_delta))}
                    </>
                  ),
                },
                {
                  label: "Saldo batch",
                  value: (
                    <>
                  {formatQuantity(movement.currentBatchBalance)} →{" "}
                  {formatQuantity(nextBalance)}
                    </>
                  ),
                },
                { label: "Alasan", value: "Koreksi input" },
              ]}
            />
            <ConfirmationPreviewNote>{note}</ConfirmationPreviewNote>
          </ConfirmationPreview>
        )}

        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <DialogFooter className="mt-1">
          <Button
            className="h-11 px-5"
            onClick={showPreview ? () => setShowPreview(false) : close}
            type="button"
            variant="outline"
          >
            {showPreview ? "Ubah catatan" : "Batal"}
          </Button>
          <Button
            className="h-11 px-5"
            isDisabled={isSaving}
            onClick={showPreview ? confirm : preview}
            type="button"
          >
            <ButtonContent
              isLoading={isSaving}
              loadingLabel="Mencatat koreksi…"
            >
              {showPreview ? "Konfirmasi koreksi" : "Tinjau koreksi"}
            </ButtonContent>
          </Button>
        </DialogFooter>
      </Dialog>
    </DialogTrigger>
  );
}
