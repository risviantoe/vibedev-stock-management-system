"use client";

import { toast } from "sonner";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import type { ProductRow } from "@/lib/domain/inventory";
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

type ComponentDraft = {
  key: string;
  productId: string;
  qty: string;
};

function componentDraft(index: number, productId = ""): ComponentDraft {
  return {
    key: `component-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    productId,
    qty: "1",
  };
}

export function BundleRecipeForm({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const activeProducts = products.filter((product) => product.is_active);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [components, setComponents] = useState<ComponentDraft[]>([
    componentDraft(0, activeProducts[0]?.id),
    componentDraft(1, activeProducts[1]?.id),
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    setShowPreview(false);
    setError(null);
  }

  function updateComponent(
    key: string,
    field: "productId" | "qty",
    value: string,
  ) {
    setComponents((current) =>
      current.map((component) =>
        component.key === key ? { ...component, [field]: value } : component,
      ),
    );
    invalidate();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!sku.trim() || !name.trim()) {
      setError("SKU dan nama bundle wajib diisi.");
      return;
    }
    if (
      !components.length ||
      components.some(
        (component) => !component.productId || Number(component.qty) <= 0,
      )
    ) {
      setError("Seluruh komponen dan quantity wajib valid.");
      return;
    }
    if (new Set(components.map((component) => component.productId)).size !== components.length) {
      setError("Satu produk tidak boleh muncul dua kali dalam susunan bundle yang sama.");
      return;
    }

    if (!showPreview) {
      setShowPreview(true);
      return;
    }

    setIsSaving(true);
    try {
      const savedSku = sku.toUpperCase();
      const result = await postJson<{ version: number }>(
        "/api/commands/marketplace/bundle",
        {
          sku,
          name,
          effectiveFrom,
          components: components.map((component) => ({
            productId: component.productId,
            qty: Number(component.qty),
          })),
        },
      );
      toast.success(`Susunan bundle versi ${result.version} berhasil disimpan.`, {
        description: `Resep aktif untuk ${savedSku} telah diperbarui.`,
      });
      setSku("");
      setName("");
      setEffectiveFrom("");
      setComponents([
        componentDraft(0, activeProducts[0]?.id),
        componentDraft(1, activeProducts[1]?.id),
      ]);
      setShowPreview(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Susunan bundle belum dapat disimpan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="operational-form mt-0" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInputField
          label="SKU bundle"
          maxLength={80}
          onChange={(event) => {
            setSku(event.target.value.toUpperCase());
            invalidate();
          }}
          placeholder="GLOW-KIT"
          required
          value={sku}
        />
        <TextInputField
          label="Nama bundle"
          maxLength={180}
          onChange={(event) => {
            setName(event.target.value);
            invalidate();
          }}
          placeholder="Glow Routine Kit"
          required
          value={name}
        />
        <DateTimeField
          className="sm:col-span-2"
          includeTime
          label="Mulai berlaku (opsional)"
          onChange={(value) => {
            setEffectiveFrom(value);
            invalidate();
          }}
          value={effectiveFrom}
        />
      </div>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              Isi fisik bundle
            </span>
            <strong className="block text-sm font-semibold text-card-foreground">
              Bundle tidak mempunyai stok sendiri
            </strong>
          </div>
          <Button
            className="h-9 px-3"
            onClick={() => {
              setComponents((current) => [
                ...current,
                componentDraft(current.length),
              ]);
              invalidate();
            }}
            type="button"
            variant="outline"
          >
            + Komponen
          </Button>
        </div>
        <div className="grid gap-3">
          {components.map((component, index) => (
            <div
              className="recipe-line grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-[2.25rem_minmax(0,1fr)_7.5rem_2.5rem] sm:items-start"
              key={component.key}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground self-start sm:mt-[1.55rem]">
                {index + 1}
              </span>
              <SelectField
                className="min-w-0"
                label="Produk fisik"
                onChange={(value) =>
                  updateComponent(component.key, "productId", value)
                }
                options={activeProducts.map((product) => ({
                  label: `${product.sku} · ${product.name}`,
                  value: product.id,
                }))}
                placeholder="Pilih produk"
                required
                searchable
                searchPlaceholder="Cari SKU atau nama produk"
                value={component.productId}
              />
              <TextInputField
                className="min-w-0"
                label="Qty / bundle"
                min={1}
                onChange={(event) =>
                  updateComponent(component.key, "qty", event.target.value)
                }
                required
                type="number"
                value={component.qty}
              />
              <Button
                aria-label={`Hapus komponen ${index + 1}`}
                className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive shrink-0 self-start sm:mt-[1.55rem]"
                isDisabled={components.length === 1}
                onClick={() => {
                  setComponents((current) =>
                    current.filter((item) => item.key !== component.key),
                  );
                  invalidate();
                }}
                type="button"
                variant="outline"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      </section>

      {showPreview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader title="Susunan bundle baru" />
          <ConfirmationPreviewSummary
            items={[
              { label: "Bundle", value: `${sku} · ${name}` },
              { label: "Komponen", value: components.length },
            ]}
          />
          <ConfirmationPreviewList>
            {components.map((component) => {
              const product = activeProducts.find(
                (item) => item.id === component.productId,
              );
              return (
                <li key={component.key}>
                  <strong>{product?.sku}</strong>
                  <span>{component.qty} unit</span>
                </li>
              );
            })}
          </ConfirmationPreviewList>
          <ConfirmationPreviewNote>
            Order lama tetap menggunakan susunan yang tercatat saat order dibuat,
            meskipun susunan aktif kemudian berubah.
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
          <ButtonContent isLoading={isSaving} loadingLabel="Menyimpan susunan bundle…">
            {showPreview ? "Konfirmasi susunan" : "Tinjau susunan"}
          </ButtonContent>
        </Button>
      </div>
    </form>
  );
}
