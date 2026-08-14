"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/status-pill";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";
import { postJson } from "@/lib/client/api";
import type { ProductMarketplaceListing } from "@/lib/domain/inventory";

type MarketplaceChannel = ProductMarketplaceListing["channel"];

const channels: Array<{
  value: MarketplaceChannel;
  label: string;
}> = [
  { value: "SHOPEE", label: "Shopee" },
  { value: "TIKTOK", label: "TikTok Shop" },
];

function channelLabel(channel: MarketplaceChannel) {
  return channels.find((option) => option.value === channel)?.label ?? channel;
}

export function MarketplaceListingForm({
  productId,
  productSku,
  productName,
  productIsActive,
  listings,
}: {
  productId: string;
  productSku: string;
  productName: string;
  productIsActive: boolean;
  listings: ProductMarketplaceListing[];
}) {
  const router = useRouter();
  const firstMissingChannel =
    channels.find(
      ({ value }) => !listings.some((listing) => listing.channel === value),
    )?.value ?? "SHOPEE";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [channel, setChannel] =
    useState<MarketplaceChannel>(firstMissingChannel);
  const [listingSku, setListingSku] = useState(productSku);
  const [isActive, setIsActive] = useState(productIsActive);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    setShowPreview(false);
    setError(null);
  }

  function beginCreate(nextChannel: MarketplaceChannel) {
    setEditingId(null);
    setChannel(nextChannel);
    setListingSku(productSku);
    setIsActive(productIsActive);
    invalidate();
  }

  function beginEdit(listing: ProductMarketplaceListing) {
    setEditingId(listing.id);
    setChannel(listing.channel);
    setListingSku(listing.listing_sku);
    setIsActive(listing.is_active);
    invalidate();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!listingSku.trim()) {
      setError("SKU marketplace wajib diisi.");
      return;
    }

    if (isActive && !productIsActive) {
      setError("Aktifkan produk terlebih dahulu sebelum mengaktifkan listing.");
      return;
    }

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const savedListingSku = listingSku.trim().toUpperCase();
      const savedChannel = channel;
      const wasEditing = Boolean(editingId);
      await postJson<{ id: string }>(
        "/api/commands/marketplace/listing",
        {
          listingId: editingId,
          productId,
          channel,
          listingSku,
          isActive,
        },
      );
      toast.success(
        wasEditing
          ? "Hubungan produk marketplace berhasil diperbarui."
          : "Produk marketplace berhasil dihubungkan.",
        {
          description: `SKU marketplace ${savedListingSku} untuk channel ${channelLabel(savedChannel)} telah disimpan.`,
        },
      );
      setShowPreview(false);
      setEditingId(null);
      setListingSku(productSku);
      setIsActive(productIsActive);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Hubungan produk marketplace belum berhasil disimpan. Masukan Anda masih ada di formulir; coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form command-card" onSubmit={submit}>
      {listings.length ? (
        <div className="listing-status-grid">
          {listings.map((listing) => (
            <article className="listing-card" key={listing.id}>
              <div className="listing-card-heading">
                <div>
                  <span className="listing-channel-mark">
                    {channelLabel(listing.channel)}
                  </span>
                  <strong>{listing.listing_sku}</strong>
                </div>
                <StatusPill tone={listing.is_active ? "success" : "neutral"}>
                  {listing.is_active ? "Aktif" : "Nonaktif"}
                </StatusPill>
              </div>
              <Button
                className="h-8 px-0"
                onClick={() => beginEdit(listing)}
                type="button"
                variant="link"
              >
                Edit listing →
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="listing-empty">
          <strong>Produk ini belum terhubung ke marketplace.</strong>
          <p>
            Buat listing aktif agar produk dapat dipilih pada order marketplace.
          </p>
        </div>
      )}

      <div className="listing-quick-actions">
        {channels.map((option) => (
          <Button
            className="h-9 px-3"
            key={option.value}
            onClick={() => beginCreate(option.value)}
            type="button"
            variant="outline"
          >
            + {option.label} dengan SKU produk
          </Button>
        ))}
      </div>

      <div className="subsection listing-editor">
        <div className="listing-editor-heading">
          <div>
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              {editingId ? "Ubah hubungan produk" : "Hubungkan produk baru"}
            </span>
            <h3>
              {editingId
                ? `${channelLabel(channel)} · ${listingSku}`
                : "Hubungkan produk ke marketplace"}
            </h3>
          </div>
          {editingId ? (
            <Button
              className="h-8 px-0"
              onClick={() => beginCreate(firstMissingChannel)}
              type="button"
              variant="link"
            >
              Batal edit
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Channel"
            onChange={(value) => {
              setChannel(value as MarketplaceChannel);
              invalidate();
            }}
            options={channels}
            value={channel}
          />
          <TextInputField
            description={`Boleh berbeda dari SKU internal ${productSku}.`}
            label="SKU marketplace"
            maxLength={100}
            onChange={(event) => {
              setListingSku(event.target.value.toUpperCase());
              invalidate();
            }}
            placeholder={productSku}
            required
            value={listingSku}
          />
        </div>

        <CheckboxField
          checked={isActive}
          className="w-full"
          description={
            productIsActive
              ? "Listing aktif langsung tersedia saat mencatat order marketplace."
              : "Produk sedang nonaktif. Aktifkan produk sebelum mengaktifkan listing."
          }
          disabled={!productIsActive}
          label="Tersedia untuk pesanan"
          onChange={(checked) => {
            setIsActive(checked);
            invalidate();
          }}
        />
      </div>

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Konfirmasi listing marketplace" />
          <ConfirmationPreviewSummary
            items={[
              { label: "Produk internal", value: `${productSku} · ${productName}` },
              { label: "Channel", value: channelLabel(channel) },
              { label: "SKU marketplace", value: listingSku },
              { label: "Status", value: isActive ? "Aktif" : "Nonaktif" },
            ]}
          />
          <ConfirmationPreviewNote>
            Saat pesanan dicatat, SKU marketplace ini akan dicocokkan dengan
            produk fisik {productSku}. Stok tersedia baru dialokasikan ketika
            pesanan dibuat.
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
          <ButtonContent isLoading={isSaving} loadingLabel="Menyimpan listing…">
            {showPreview ? "Konfirmasi listing" : "Tinjau listing"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
