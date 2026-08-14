"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useMemo, useState } from "react";
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
  ConfirmationPreviewList,
  ConfirmationPreviewNote,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";
import { Input } from "@/components/ui/input";
import type {
  ReturnCandidate,
  ReturnReceipt,
} from "@/lib/domain/operations";

function draftId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ReturnCreateForm({
  candidates,
}: {
  candidates: ReturnCandidate[];
}) {
  const router = useRouter();
  const orders = useMemo(() => {
    const unique = new Map<
      string,
      Pick<ReturnCandidate, "externalOrderId" | "channel">
    >();
    for (const candidate of candidates) {
      const key = `${candidate.channel}:${candidate.externalOrderId}`;
      unique.set(key, candidate);
    }
    return Array.from(unique.entries());
  }, [candidates]);
  const [orderKey, setOrderKey] = useState(orders[0]?.[0] ?? "");
  const [externalReturnId, setExternalReturnId] = useState(
    draftId("RETURN"),
  );
  const [commandKey, setCommandKey] = useState(draftId("ui:return"));
  const [createdAt, setCreatedAt] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidates = candidates.filter(
    (candidate) =>
      `${candidate.channel}:${candidate.externalOrderId}` === orderKey,
  );
  const selectedOrder = selectedCandidates[0] ?? null;
  const selectedItems = selectedCandidates
    .map((candidate) => ({
      candidate,
      qty: Number(quantities[candidate.key] ?? 0),
    }))
    .filter((item) => item.qty > 0);

  function invalidate() {
    setCommandKey(draftId("ui:return"));
    setShowPreview(false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedOrder) {
      setError("Belum ada pesanan dengan jumlah yang dapat diretur.");
      return;
    }
    if (!externalReturnId.trim()) {
      setError("ID retur marketplace wajib diisi.");
      return;
    }
    if (!selectedItems.length) {
      setError("Isi jumlah retur pada minimal satu produk.");
      return;
    }
    if (
      selectedItems.some(
        ({ candidate, qty }) =>
          !Number.isSafeInteger(qty) ||
          qty <= 0 ||
          qty > candidate.returnableQty,
      )
    ) {
      setError("Jumlah retur melebihi sisa barang yang dapat diretur. Kurangi jumlah lalu coba lagi.");
      return;
    }

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const receipt = await postJson<ReturnReceipt>(
        "/api/commands/returns/create",
        {
          idempotencyKey: commandKey,
          channel: selectedOrder.channel,
          externalOrderId: selectedOrder.externalOrderId,
          externalReturnId,
          createdAt,
          items: selectedItems.map(({ candidate, qty }) => ({
            orderItemId: candidate.orderItemId,
            productId: candidate.productId,
            qty,
          })),
        },
      );
      if (receipt.outcome === "REJECTED") {
        setError(receipt.error?.message ?? "Return ditolak.");
        setShowPreview(false);
        return;
      }
      toast.success("Penerimaan retur barang berhasil dicatat.", {
        description: `${externalReturnId} berhasil dibuat dengan ${selectedItems.length} item inspeksi.`,
      });
      setShowPreview(false);
      setQuantities({});
      setExternalReturnId(draftId("RETURN"));
      setCommandKey(draftId("ui:return"));
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Retur belum berhasil dibuat. Masukan Anda masih ada di formulir; coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!candidates.length) {
    return (
      <EmptyState
        description="Buat dan kirim order marketplace terlebih dahulu. Return hanya dapat dibuat dari produk fisik yang benar-benar terkirim."
        title="Belum ada item yang dapat diretur."
      />
    );
  }

  return (
    <form className="operational-form command-card" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Order yang sudah dikirim"
          onChange={(value) => {
            setOrderKey(value);
            setQuantities({});
            invalidate();
          }}
          options={orders.map(([key, order]) => ({
            description: order.channel,
            label: order.externalOrderId,
            value: key,
          }))}
          searchable
          searchPlaceholder="Cari ID order atau channel"
          value={orderKey}
        />
        <TextInputField
          label="ID retur marketplace"
          maxLength={160}
          onChange={(event) => {
            setExternalReturnId(event.target.value.toUpperCase());
            invalidate();
          }}
          required
          value={externalReturnId}
        />
        <DateTimeField
          includeTime
          label="Waktu retur (opsional)"
          onChange={(value) => {
            setCreatedAt(value);
            invalidate();
          }}
          value={createdAt}
        />
      </div>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              Retur sebagian
            </span>
            <strong className="block text-sm font-semibold text-card-foreground">
              Pilih produk dan jumlah barang yang kembali
            </strong>
          </div>
          <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {selectedCandidates.length} produk dapat dipilih
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {selectedCandidates.map((candidate) => (
            <label className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3" key={candidate.key}>
              <span className="grid gap-0.5">
                <strong className="text-sm font-semibold text-card-foreground">
                  {candidate.product?.sku ?? "Produk"} ·{" "}
                  {candidate.product?.name}
                </strong>
                <small className="text-xs text-muted-foreground">
                  {candidate.externalLineId} · {candidate.listingSku}
                </small>
              </span>
              <span className="grid gap-1.5">
                <small className="text-xs text-muted-foreground">
                  Terkirim {candidate.shippedQty} · sudah diretur{" "}
                  {candidate.returnedQty}
                </small>
                <Input
                  className="h-10"
                  max={candidate.returnableQty}
                  min={0}
                  onChange={(event) => {
                    setQuantities((current) => ({
                      ...current,
                      [candidate.key]: event.target.value,
                    }));
                    invalidate();
                  }}
                  type="number"
                  value={quantities[candidate.key] ?? "0"}
                />
              </span>
            </label>
          ))}
        </div>
      </section>

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Konfirmasi retur" />
          <ConfirmationPreviewSummary
            items={[
              { label: "Retur", value: externalReturnId },
              { label: "Order", value: selectedOrder?.externalOrderId },
              { label: "Channel", value: selectedOrder?.channel },
              { label: "Produk", value: selectedItems.length },
            ]}
          />
          <ConfirmationPreviewList>
            {selectedItems.map(({ candidate, qty }) => (
              <li key={candidate.key}>
                <strong>{candidate.product?.sku}</strong>
                <span>{qty} unit</span>
              </li>
            ))}
          </ConfirmationPreviewList>
          <ConfirmationPreviewNote>
            Pencatatan retur belum menambah stok. Kondisi fisik ditentukan
            terpisah pada tahap inspeksi.
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
          <ButtonContent isLoading={isSaving} loadingLabel="Mencatat retur…">
            {showPreview ? "Konfirmasi retur" : "Tinjau retur"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
