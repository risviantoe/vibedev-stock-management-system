import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { notFound } from "next/navigation";
import { BatchForm } from "@/components/forms/batch-form";
import { MarketplaceListingForm } from "@/components/forms/marketplace-listing-form";
import { OpeningBalanceForm } from "@/components/forms/opening-balance-form";
import { ProductForm } from "@/components/forms/product-form";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import {
  batchSourceLabel,
  formatDate,
  formatQuantity,
} from "@/lib/domain/inventory";
import { getProductInventory } from "@/lib/data/inventory";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductInventory(id);

  if (!product) {
    notFound();
  }

  const activeListingCount = product.marketplaceListings.filter(
    (listing) => listing.is_active,
  ).length;
  const unverifiedOpeningCount = product.batches.filter(
    (batch) =>
      batch.openingBalance?.verification_status === "UNVERIFIED",
  ).length;
  const openingCandidates = product.batches.filter(
    (batch) =>
      batch.source_type === "PRODUCTION" && !batch.openingBalance,
  );

  return (
    <>
      <PageHeader
        actions={
          <>
          <LinkButton className="h-11 px-5" href="/products" variant="outline">
            ← Semua produk
          </LinkButton>
          <LinkButton
            className="h-11 px-5"
            href={`/products/${product.id}/explain`}
          >
            Mengapa stoknya segini?
          </LinkButton>
          </>
        }
        description={`${product.sku} · ${formatQuantity(product.onHandQty)} stok fisik · ${formatQuantity(product.reservedQty)} dialokasikan`}
        title={product.name}
      />

      <div className="app-content">
        <section className="metric-grid operational-metrics product-balance-metrics">
          <MetricCard description="Saldo fisik seluruh batch" label="Stok fisik" value={formatQuantity(product.onHandQty)} />
          <MetricCard description="Disiapkan untuk order yang belum dikirim" label="Dialokasikan" value={formatQuantity(product.reservedQty)} />
          <MetricCard description="Stok fisik setelah dikurangi alokasi" label="Tersedia" value={formatQuantity(product.availableQty)} />
        </section>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Listing Shopee &amp; TikTok Shop</h2>
            </div>
            <StatusPill tone={activeListingCount ? "success" : "neutral"}>
              {activeListingCount
                ? `${activeListingCount} listing aktif`
                : "Belum ada listing aktif"}
            </StatusPill>
          </div>
          <p className="section-description">
            Listing SKU adalah identitas produk di marketplace dan boleh
            berbeda dari SKU internal. Hanya listing aktif yang dapat dipilih
            saat mencatat order marketplace.
          </p>
          <MarketplaceListingForm
            listings={product.marketplaceListings}
            productId={product.id}
            productIsActive={product.is_active}
            productName={product.name}
            productSku={product.sku}
          />
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Edit produk</h2>
            </div>
            <StatusPill tone={product.is_active ? "success" : "neutral"}>
              {product.is_active ? "Aktif" : "Nonaktif"}
            </StatusPill>
          </div>
          <ProductForm
            initial={{
              id: product.id,
              sku: product.sku,
              name: product.name,
              isActive: product.is_active,
            }}
          />
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Batch produk</h2>
            </div>
            <StatusPill tone="info">
              {product.batches.length} batch
            </StatusPill>
          </div>

          {product.batches.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.batches.map((batch) => (
                <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-muted/20 p-4" key={batch.id}>
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                      {batchSourceLabel(batch.source_type)}
                    </span>
                    <h3 className="mt-1 text-base font-semibold text-card-foreground">{batch.batch_code}</h3>
                    <p className="text-sm text-muted-foreground">Kedaluwarsa {formatDate(batch.expiry_date)}</p>
                  </div>
                  <strong className="text-lg font-semibold text-card-foreground">{formatQuantity(batch.onHandQty)} unit</strong>
                  <StatusPill
                    tone={
                      batch.openingBalance?.verification_status === "UNVERIFIED"
                        ? "warning"
                        : batch.openingBalance
                          ? "success"
                          : "neutral"
                    }
                  >
                    {batch.openingBalance?.verification_status === "UNVERIFIED"
                      ? "Saldo awal belum diverifikasi"
                      : batch.openingBalance
                        ? "Saldo awal terverifikasi"
                        : "Tanpa saldo awal"}
                  </StatusPill>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Buat batch produksi pertama di bawah ini."
              title="Belum ada batch."
            />
          )}

          <div className="subsection">
            <h3>Buat batch kosong</h3>
            <p>
              Batch baru memiliki saldo nol sampai saldo awal atau penerimaan
              barang dicatat.
            </p>
            <BatchForm productId={product.id} />
          </div>
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Saldo awal</h2>
            </div>
            <StatusPill
              tone={unverifiedOpeningCount ? "warning" : "success"}
            >
              {unverifiedOpeningCount
                ? `${unverifiedOpeningCount} belum terverifikasi`
                : "Semua saldo awal terverifikasi"}
            </StatusPill>
          </div>
          <p className="section-description">
            Saldo awal menghasilkan catatan pergerakan stok dan baru dianggap
            terverifikasi setelah opname pertama.
          </p>
          {openingCandidates.length ? (
            <OpeningBalanceForm
              batches={openingCandidates}
              productId={product.id}
            />
          ) : (
            <EmptyState
              description="Batch retur mendapat saldo dari inspeksi dan tidak memakai saldo awal."
              title="Tidak ada batch produksi yang membutuhkan saldo awal."
            />
          )}
        </Panel>
      </div>
    </>
  );
}
