import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { Pagination } from "@/components/pagination";
import { ProductForm } from "@/components/forms/product-form";
import { OperationalTableToolbar } from "@/components/operational-table-toolbar";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatDate,
  formatQuantity,
} from "@/lib/domain/inventory";
import { getInventorySnapshotPage } from "@/lib/data/inventory";
import {
  parsePage,
  parsePageSize,
  type PaginationSearchParams,
} from "@/lib/pagination";
import {
  hasActiveRetrieval,
  optionalQueryValue,
  parseProductRetrieval,
} from "@/lib/retrieval";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const retrieval = parseProductRetrieval(params);
  const result = await getInventorySnapshotPage(page, pageSize, retrieval);
  const products = result.items;
  const hasFilters = hasActiveRetrieval(
    {
      q: retrieval.search,
      status: retrieval.status,
      expiry: retrieval.expiry,
      sort: retrieval.sort,
    },
    { q: "", status: "ACTIVE", expiry: "ALL", sort: "SKU_ASC" },
  );

  return (
    <>
      <PageHeader
        description="Kelola produk, batch, tanggal kedaluwarsa, dan saldo terkini dalam satu tampilan."
        title="Produk & Batch"
      />

      <div className="app-content">
        <Panel>
          <div className="section-heading">
            <div>
              <h2>Produk baru</h2>
            </div>
          </div>
          <ProductForm />
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2 id="products-table-heading">{formatQuantity(result.total)} produk</h2>
            </div>
          </div>

          <OperationalTableToolbar
            fields={[
              {
                defaultValue: "ACTIVE",
                label: "Status produk",
                name: "status",
                options: [
                  { label: "Aktif", value: "ACTIVE" },
                  { label: "Semua status", value: "ALL" },
                  { label: "Nonaktif", value: "INACTIVE" },
                ],
                value: retrieval.status,
              },
              {
                defaultValue: "ALL",
                label: "Kedaluwarsa",
                name: "expiry",
                options: [
                  { label: "Semua tanggal kedaluwarsa", value: "ALL" },
                  { label: "Sudah kedaluwarsa", value: "EXPIRED" },
                  { label: "Dalam 30 hari", value: "DAYS_30" },
                  { label: "Dalam 90 hari", value: "DAYS_90" },
                ],
                value: retrieval.expiry,
              },
              {
                defaultValue: "SKU_ASC",
                label: "Urutkan",
                name: "sort",
                options: [
                  { label: "SKU A–Z", value: "SKU_ASC" },
                  { label: "Kedaluwarsa terdekat", value: "EXPIRY_ASC" },
                  { label: "Stok tersedia terendah", value: "AVAILABLE_ASC" },
                  { label: "Terakhir diperbarui", value: "UPDATED_DESC" },
                ],
                value: retrieval.sort,
              },
            ]}
            searchLabel="Cari produk"
            searchParam="q"
            searchPlaceholder="SKU atau nama produk"
            searchValue={retrieval.search}
          />

          {products.length ? (
            <div className="mt-4">
              <Table aria-labelledby="products-table-heading" className="min-w-[70rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU / Produk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Kedaluwarsa terdekat</TableHead>
                  <TableHead className="text-right">Stok fisik</TableHead>
                  <TableHead className="text-right">Dialokasikan</TableHead>
                  <TableHead className="text-right">Tersedia</TableHead>
                  <TableHead>Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const nearestBatch = product.batches
                    .filter((batch) => batch.onHandQty > 0)
                    .sort((a, b) =>
                      a.expiry_date.localeCompare(b.expiry_date),
                    )[0];
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="primary-cell">
                          <strong className="identifier">{product.sku}</strong>
                          <span>{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          tone={product.is_active ? "success" : "neutral"}
                        >
                          {product.is_active ? "Aktif" : "Nonaktif"}
                        </StatusPill>
                      </TableCell>
                      <TableCell>{formatQuantity(product.batches.length)}</TableCell>
                      <TableCell>
                        {nearestBatch
                          ? formatDate(nearestBatch.expiry_date)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <strong>{formatQuantity(product.onHandQty)}</strong>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(product.reservedQty)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <strong>{formatQuantity(product.availableQty)}</strong>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <LinkButton
                          className="h-8 px-0"
                          href={`/products/${product.id}`}
                          variant="link"
                        >
                          Detail →
                        </LinkButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              description={
                hasFilters
                  ? "Ubah pencarian, filter, atau urutan untuk melihat produk lain."
                  : "Buat produk baru atau pilih Semua status untuk melihat produk nonaktif."
              }
              title={
                hasFilters
                  ? "Tidak ada produk yang cocok."
                  : "Belum ada produk aktif."
              }
            />
          )}
          <Pagination
            basePath="/products"
            page={page}
            pageSize={pageSize}
            query={{
              q: optionalQueryValue(retrieval.search),
              status: optionalQueryValue(retrieval.status, "ACTIVE"),
              expiry: optionalQueryValue(retrieval.expiry, "ALL"),
              sort: optionalQueryValue(retrieval.sort, "SKU_ASC"),
            }}
            total={result.total}
          />
        </Panel>
      </div>
    </>
  );
}
