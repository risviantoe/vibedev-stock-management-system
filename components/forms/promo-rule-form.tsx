"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import type { ProductRow } from "@/lib/domain/inventory";
import type { MarketplaceChannel } from "@/lib/domain/marketplace";
import { DateTimeField } from "@/components/ui/date-time-field";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewContent,
  ConfirmationPreviewHeader,
  ConfirmationPreviewNote,
} from "@/components/confirmation-preview";

function localDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function PromoRuleForm({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const activeProducts = products.filter((product) => product.is_active);
  const initialStart = new Date();
  const initialEnd = new Date(initialStart);
  initialEnd.setDate(initialEnd.getDate() + 30);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<MarketplaceChannel>("SHOPEE");
  const [startAt, setStartAt] = useState(localDateTime(initialStart));
  const [endAt, setEndAt] = useState(localDateTime(initialEnd));
  const [triggerProductId, setTriggerProductId] = useState(
    activeProducts[0]?.id ?? "",
  );
  const [triggerQty, setTriggerQty] = useState("2");
  const [freeProductId, setFreeProductId] = useState(
    activeProducts[1]?.id ?? activeProducts[0]?.id ?? "",
  );
  const [freeQty, setFreeQty] = useState("1");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    setShowPreview(false);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (
      !name.trim() ||
      !triggerProductId ||
      !freeProductId ||
      Number(triggerQty) <= 0 ||
      Number(freeQty) <= 0
    ) {
      setError("Seluruh aturan promo wajib diisi dengan nilai valid.");
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError("Waktu selesai promo harus setelah waktu mulai.");
      return;
    }
    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const savedName = name;
      const savedChannel = channel;
      await postJson("/api/commands/marketplace/promo", {
        name,
        channel,
        startAt,
        endAt,
        triggerProductId,
        triggerQty: Number(triggerQty),
        freeProductId,
        freeQty: Number(freeQty),
      });
      toast.success("Aturan promo berhasil disimpan.", {
        description: `Promo "${savedName}" siap diterapkan untuk ${savedChannel}.`,
      });
      setName("");
      setStartAt(localDateTime(new Date()));
      const nextEnd = new Date();
      nextEnd.setDate(nextEnd.getDate() + 30);
      setEndAt(localDateTime(nextEnd));
      setTriggerQty("2");
      setFreeQty("1");
      setShowPreview(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Promo belum dapat disimpan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const triggerProduct = activeProducts.find(
    (product) => product.id === triggerProductId,
  );
  const freeProduct = activeProducts.find(
    (product) => product.id === freeProductId,
  );

  return (
    <form className="operational-form mt-0" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          className="sm:col-span-2"
          label="Nama promo"
          maxLength={180}
          onChange={(event) => {
            setName(event.target.value);
            invalidate();
          }}
          placeholder="Buy 2 Serum Get 1 Mask"
          required
          value={name}
        />
        <SelectField
          className="sm:col-span-2"
          label="Channel"
          onChange={(value) => {
            setChannel(value as MarketplaceChannel);
            invalidate();
          }}
          options={[
            { label: "Shopee", value: "SHOPEE" },
            { label: "TikTok Shop", value: "TIKTOK" },
          ]}
          value={channel}
        />
        <DateTimeField
          includeTime
          label="Mulai berlaku"
          onChange={(value) => {
            setStartAt(value);
            invalidate();
          }}
          required
          value={startAt}
        />
        <DateTimeField
          includeTime
          label="Berakhir"
          onChange={(value) => {
            setEndAt(value);
            invalidate();
          }}
          required
          value={endAt}
        />
        <SelectField
          label="Produk pemicu"
          onChange={(value) => {
            setTriggerProductId(value);
            invalidate();
          }}
          options={activeProducts.map((product) => ({
            label: `${product.sku} · ${product.name}`,
            value: product.id,
          }))}
          searchable
          searchPlaceholder="Cari SKU atau nama produk"
          value={triggerProductId}
        />
        <TextInputField
          label="Qty pemicu"
          min={1}
          onChange={(event) => {
            setTriggerQty(event.target.value);
            invalidate();
          }}
          required
          type="number"
          value={triggerQty}
        />
        <SelectField
          label="Produk bonus"
          onChange={(value) => {
            setFreeProductId(value);
            invalidate();
          }}
          options={activeProducts.map((product) => ({
            label: `${product.sku} · ${product.name}`,
            value: product.id,
          }))}
          searchable
          searchPlaceholder="Cari SKU atau nama produk"
          value={freeProductId}
        />
        <TextInputField
          label="Qty bonus"
          min={1}
          onChange={(event) => {
            setFreeQty(event.target.value);
            invalidate();
          }}
          required
          type="number"
          value={freeQty}
        />
      </div>

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Periksa aturan promo" />
          <ConfirmationPreviewContent>
            <p className="text-base leading-relaxed">
            Untuk setiap <strong>{triggerQty} × {triggerProduct?.sku}</strong>{" "}
            di {channel}, tambahkan{" "}
            <strong>{freeQty} × {freeProduct?.sku}</strong>.
            </p>
          </ConfirmationPreviewContent>
          <ConfirmationPreviewNote>
            Promo yang cocok diekspansi dan dibekukan saat order dibuat. Edit
            aturan di masa depan tidak mengubah order lama.
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
          <ButtonContent isLoading={isSaving} loadingLabel="Menyimpan promo…">
            {showPreview ? "Konfirmasi promo" : "Tinjau promo"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
