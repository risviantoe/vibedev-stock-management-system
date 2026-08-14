"use client";

import { toast } from "sonner";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import {
  marketplaceEventLabel,
  type MarketplaceChannel,
  type MarketplaceEventReceipt,
  type MarketplaceEventType,
  type MarketplaceListing,
} from "@/lib/domain/marketplace";
import { DateTimeField } from "@/components/ui/date-time-field";
import { SelectField } from "@/components/ui/select-field";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";
import { Plus, X } from "lucide-react";

type SimulatorItem = {
  key: string;
  externalLineId: string;
  listingSku: string;
  quantity: string;
};

function draftId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function currentLocalDateTime(): string {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function newItem(index: number): SimulatorItem {
  return {
    key: draftId("line"),
    externalLineId: `LINE-${index + 1}`,
    listingSku: "",
    quantity: "1",
  };
}

export function MarketplaceSimulatorForm({
  listings,
  initialOrderId = "",
  initialEventType = "ORDER_CREATED",
  initialChannel = "SHOPEE",
  compact = false,
}: {
  listings: MarketplaceListing[];
  initialOrderId?: string;
  initialEventType?: MarketplaceEventType;
  initialChannel?: MarketplaceChannel;
  compact?: boolean;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<MarketplaceChannel>(initialChannel);
  const [eventType, setEventType] =
    useState<MarketplaceEventType>(initialEventType);
  const [externalEventId, setExternalEventId] = useState(
    draftId("SIM-EVT"),
  );
  const [externalOrderId, setExternalOrderId] = useState(
    initialOrderId || draftId("ORDER"),
  );
  const [occurredAt, setOccurredAt] = useState("");
  const [items, setItems] = useState<SimulatorItem[]>([newItem(0)]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<MarketplaceEventReceipt | null>(null);

  const channelListings = useMemo(
    () =>
      listings.filter(
        (listing) => listing.channel === channel && listing.is_active,
      ),
    [channel, listings],
  );
  const activeListingCounts = useMemo(
    () => ({
      SHOPEE: listings.filter(
        (listing) => listing.channel === "SHOPEE" && listing.is_active,
      ).length,
      TIKTOK: listings.filter(
        (listing) => listing.channel === "TIKTOK" && listing.is_active,
      ).length,
    }),
    [listings],
  );
  const selectedChannelLabel =
    channel === "SHOPEE" ? "Shopee" : "TikTok Shop";

  function invalidate() {
    setShowPreview(false);
    setReceipt(null);
    setError(null);
  }

  function updateItem(
    key: string,
    field: keyof Omit<SimulatorItem, "key">,
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
    invalidate();
  }

  function changeEventType(next: MarketplaceEventType) {
    setEventType(next);
    setExternalEventId(draftId("SIM-EVT"));
    if (next === "ORDER_CREATED" && !initialOrderId) {
      setExternalOrderId(draftId("ORDER"));
    }
    invalidate();
  }

  function addItem() {
    setItems((current) => [...current, newItem(current.length)]);
    invalidate();
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
    invalidate();
  }

  function validate(): string | null {
    if (!externalEventId.trim() || !externalOrderId.trim()) {
      return "Event ID dan order ID wajib diisi.";
    }
    if (eventType === "ORDER_SHIPPED") {
      return null;
    }
    if (!items.length) {
      return "Minimal satu item wajib diisi.";
    }
    for (const [index, item] of items.entries()) {
      if (!item.externalLineId.trim() || Number(item.quantity) <= 0) {
        return `Line ID dan quantity item ${index + 1} belum valid.`;
      }
      if (eventType === "ORDER_CREATED" && !item.listingSku) {
        return `Listing item ${index + 1} wajib dipilih.`;
      }
    }
    return null;
  }

  function previewEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    if (!occurredAt) {
      setOccurredAt(currentLocalDateTime());
    }
    setError(null);
    setShowPreview(true);
  }

  async function confirmEvent() {
    if (!showPreview) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await postJson<MarketplaceEventReceipt>(
        "/api/commands/marketplace/event",
        {
          externalEventId,
          externalOrderId,
          channel,
          eventType,
          occurredAt,
          items: eventType === "ORDER_SHIPPED"
            ? []
            : items.map((item) => ({
                externalLineId: item.externalLineId,
                listingSku: item.listingSku,
                quantity: Number(item.quantity),
              })),
        },
      );
      toast.success("Event pesanan berhasil diproses.", {
        description: `Pesanan ${externalOrderId} (${eventType}) telah tercatat di ledger.`,
      });
      setReceipt(result);
      setShowPreview(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Event marketplace belum dapat diproses.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className={`operational-form command-card marketplace-command ${
        compact ? "compact-command" : ""
      }`}
      onSubmit={previewEvent}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Channel"
          onChange={(value) => {
            setChannel(value as MarketplaceChannel);
            setItems((current) =>
              current.map((item) => ({ ...item, listingSku: "" })),
            );
            invalidate();
          }}
          options={[
            {
              description: `${activeListingCounts.SHOPEE} listing aktif`,
              label: "Shopee",
              value: "SHOPEE",
            },
            {
              description: `${activeListingCounts.TIKTOK} listing aktif`,
              label: "TikTok Shop",
              value: "TIKTOK",
            },
          ]}
          value={channel}
        />
        <SelectField
          label="Tahap order"
          onChange={(value) => changeEventType(value as MarketplaceEventType)}
          options={[
            { label: "Order diterima", value: "ORDER_CREATED" },
            { label: "Order masuk proses pengiriman", value: "ORDER_SHIPPED" },
            { label: "Order dibatalkan", value: "ORDER_CANCELLED" },
          ]}
          value={eventType}
        />
        <TextInputField
          label="ID event marketplace"
          maxLength={160}
          onChange={(event) => {
            setExternalEventId(event.target.value);
            invalidate();
          }}
          required
          value={externalEventId}
        />
        <TextInputField
          label="ID order marketplace"
          maxLength={160}
          onChange={(event) => {
            setExternalOrderId(event.target.value);
            invalidate();
          }}
          required
          value={externalOrderId}
        />
        <DateTimeField
          className="sm:col-span-2"
          includeTime
          label="Waktu kejadian (opsional)"
          onChange={(value) => {
            setOccurredAt(value);
            invalidate();
          }}
          value={occurredAt}
        />
      </div>

      {eventType !== "ORDER_SHIPPED" ? (
        <section className="grid gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <span className="text-xs font-semibold tracking-widest text-primary uppercase">
                {eventType === "ORDER_CREATED"
                  ? "Order multi-item"
                  : "Item yang dibatalkan"}
              </span>
              <strong className="block text-sm font-semibold text-card-foreground">
                {eventType === "ORDER_CREATED"
                  ? "Listing akan diekspansi menjadi produk fisik"
                  : "Pembatalan dapat parsial per line"}
              </strong>
            </div>
            <Button
              className="h-10 px-4"
              onClick={addItem}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden="true" />
              Tambah item
            </Button>
          </div>

          <div className="grid gap-3">
            {items.map((item, index) => (
              <div
                className={`marketplace-line grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:items-start ${
                  eventType === "ORDER_CREATED"
                    ? "sm:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,2fr)_6rem_2.5rem]"
                    : "sm:grid-cols-[2.25rem_minmax(0,1fr)_6rem_2.5rem]"
                }`}
                key={item.key}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground self-start sm:mt-[1.55rem]">
                  {index + 1}
                </span>
                <TextInputField
                  className="min-w-0"
                  label="Line ID"
                  onChange={(event) =>
                    updateItem(
                      item.key,
                      "externalLineId",
                      event.target.value,
                    )
                  }
                  required
                  value={item.externalLineId}
                />
                {eventType === "ORDER_CREATED" ? (
                  <SelectField
                    className="min-w-0"
                    description={`Hanya menampilkan listing aktif di ${selectedChannelLabel}.`}
                    label={`Listing SKU · ${selectedChannelLabel}`}
                    onChange={(value) =>
                      updateItem(item.key, "listingSku", value)
                    }
                    options={channelListings.map((listing) => ({
                      description: `${listing.product?.name ?? listing.bundle?.name} · ${
                        listing.listing_type === "BUNDLE" ? "Bundle" : "Produk"
                      }`,
                      label: listing.listing_sku,
                      value: listing.listing_sku,
                    }))}
                    placeholder={`Pilih listing ${selectedChannelLabel}`}
                    required
                    searchable
                    searchPlaceholder="Cari SKU listing atau nama produk"
                    value={item.listingSku}
                  />
                ) : null}
                <TextInputField
                  className="min-w-0"
                  label="Qty"
                  min={1}
                  onChange={(event) =>
                    updateItem(item.key, "quantity", event.target.value)
                  }
                  required
                  type="number"
                  value={item.quantity}
                />
                <Button
                  aria-label={`Hapus item ${index + 1}`}
                  className="size-10 p-0 text-muted-foreground hover:text-destructive shrink-0 self-start sm:mt-[1.55rem]"
                  isDisabled={items.length === 1}
                  onClick={() => removeItem(item.key)}
                  size="icon"
                  type="button"
                  variant="destructive"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="inline-note">
          Shopee memotong stok saat <strong>SHIPPED</strong>; TikTok menggunakan
          event yang sama tetapi status akhirnya <strong>IN_TRANSIT</strong>.
        </p>
      )}

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Periksa event sebelum disimpan" />
          <ConfirmationPreviewSummary
            items={[
              { label: "Event", value: marketplaceEventLabel(eventType) },
              { label: "Order", value: externalOrderId },
              { label: "Channel", value: channel },
              {
                label: "Item",
                value: eventType === "ORDER_SHIPPED" ? 0 : items.length,
              },
            ]}
          />
          <ConfirmationPreviewNote>
            Sistem akan memvalidasi event, mengalokasikan stok sesuai status
            order, dan mencatat seluruh perubahan sebagai satu transaksi.
          </ConfirmationPreviewNote>
        </ConfirmationPreview>
      ) : null}

      {receipt ? (
        <section
          className={`command-result result-${receipt.outcome.toLowerCase()}`}
          aria-live="polite"
        >
          <div>
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              Hasil pemrosesan
            </span>
            <strong>{receipt.outcome}</strong>
            <p>
              {receipt.outcome === "REJECTED"
                ? receipt.error?.message ?? "Event ditolak tanpa mengubah stok."
                : receipt.order
                  ? `${receipt.order.external_order_id} · ${receipt.order.status}`
                  : receipt.error?.message ?? "Event tercatat."}
            </p>
          </div>
          <Link href={`/marketplace/events/${receipt.event.id}`}>
            Buka bukti event →
          </Link>
        </section>
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
            Ubah input
          </Button>
        ) : null}
        {showPreview ? (
          <Button
            className="h-11 px-5"
            isDisabled={isSaving}
            onClick={confirmEvent}
            type="button"
          >
            <ButtonContent isLoading={isSaving} loadingLabel="Memproses event…">
              Simpan event
            </ButtonContent>
          </Button>
        ) : (
          <Button className="h-11 px-5" isDisabled={isSaving} type="submit">
            Tinjau event
          </Button>
        )}
      </div>
    </form>
  );
}
