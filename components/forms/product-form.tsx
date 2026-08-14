"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewHeader,
  ConfirmationPreviewSummary,
} from "@/components/confirmation-preview";

type ProductDraft = {
  id?: string;
  sku: string;
  name: string;
  isActive: boolean;
};

export function ProductForm({
  initial,
}: {
  initial?: {
    id: string;
    sku: string;
    name: string;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>({
    id: initial?.id,
    sku: initial?.sku ?? "",
    name: initial?.name ?? "",
    isActive: initial?.isActive ?? true,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial);

  function update<K extends keyof ProductDraft>(
    key: K,
    value: ProductDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setShowPreview(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!draft.sku.trim() || !draft.name.trim()) {
      setError("SKU dan nama produk wajib diisi.");
      return;
    }

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const savedSku = draft.sku.trim().toUpperCase();
      await postJson("/api/catalog/products", {
        id: draft.id ?? null,
        sku: draft.sku,
        name: draft.name,
        isActive: draft.isActive,
      });
      toast.success(
        isEdit
          ? "Perubahan produk berhasil disimpan."
          : "Produk baru berhasil disimpan.",
        {
          description: isEdit
            ? `Data untuk ${savedSku} telah diperbarui.`
            : `Produk ${savedSku} siap diberi batch stok.`,
        },
      );
      setShowPreview(false);
      if (!isEdit) {
        setDraft({ sku: "", name: "", isActive: true });
      }
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Produk belum dapat disimpan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          label="SKU"
          maxLength={80}
          onChange={(event) => update("sku", event.target.value.toUpperCase())}
          placeholder="SERUM-A"
          required
          value={draft.sku}
        />
        <TextInputField
          label="Nama produk"
          maxLength={180}
          onChange={(event) => update("name", event.target.value)}
          placeholder="Barrier Repair Serum"
          required
          value={draft.name}
        />
      </div>

      {isEdit ? (
        <CheckboxField
          checked={draft.isActive}
          description="Produk dengan histori tidak dihapus; nonaktifkan agar tidak dapat dipakai transaksi baru."
          label="Produk aktif"
          onChange={(checked) => update("isActive", checked)}
        />
      ) : null}

      {showPreview ? (
        <ConfirmationPreview aria-label="Preview produk">
          <ConfirmationPreviewHeader title="Periksa sebelum simpan" />
          <ConfirmationPreviewSummary
            items={[
              { label: "SKU", value: draft.sku.trim().toUpperCase() },
              { label: "Nama", value: draft.name.trim() },
              {
                label: "Status",
                value: draft.isActive ? "Aktif" : "Nonaktif",
              },
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
          <ButtonContent isLoading={isSaving} loadingLabel="Menyimpan produk…">
            {showPreview ? "Konfirmasi simpan" : "Tinjau perubahan"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
