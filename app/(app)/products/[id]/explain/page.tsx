import { LinkButton } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProductInventory } from "@/lib/data/inventory";
import { getProductBalanceExplanation } from "@/lib/data/proof";
import {
  batchSourceLabel,
  channelLabel,
  formatDate,
  formatDateTime,
  formatQuantity,
  reasonLabel,
} from "@/lib/domain/inventory";

export default async function ExplainProductBalancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductInventory(id);

  if (!product) {
    notFound();
  }

  const explanation = await getProductBalanceExplanation(id);

  return (
    <>
      <PageHeader
        actions={
          <>
            <LinkButton className="h-11 px-5" href={`/products/${id}`} variant="outline">
              Kembali ke produk
            </LinkButton>
            <LinkButton className="h-11 px-5" href="/integrity">
              Buka Pemeriksaan Stok
            </LinkButton>
          </>
        }
        description={`${product.sku} · rincian seluruh barang masuk dan keluar hingga membentuk saldo saat ini.`}
        title="Mengapa stoknya segini?"
      />

      <div className="app-content">
        <section
          className={`balance-equation balance-equation-${
            explanation.matches_projection ? "pass" : "fail"
          }`}
        >
          <div>
            <span>Ledger breakdown</span>
            <strong>{formatQuantity(explanation.breakdown_total)}</strong>
          </div>
          <b>=</b>
          <div>
            <span>Saldo tersimpan</span>
            <strong>{formatQuantity(explanation.projection_qty)}</strong>
          </div>
          <div className="equation-verdict">
            <StatusPill
              tone={explanation.matches_projection ? "success" : "danger"}
            >
              {explanation.matches_projection ? "Sesuai" : "Berbeda"}
            </StatusPill>
            <small>
              Dihitung {formatDateTime(explanation.generated_at)}
            </small>
          </div>
        </section>

        <section className="metric-grid operational-metrics">
          <MetricCard description="Saldo tersimpan seluruh batch" label="Stok fisik" value={formatQuantity(explanation.projection_qty)} />
          <MetricCard description="Penjumlahan seluruh pergerakan stok" label="Total riwayat" value={formatQuantity(explanation.ledger_qty)} />
          <MetricCard description="Belum memotong stok fisik" label="Dialokasikan" value={formatQuantity(explanation.reserved_qty)} />
          <MetricCard description="Stok fisik setelah dikurangi alokasi" label="Tersedia" value={formatQuantity(explanation.available_qty)} />
        </section>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Kontributor saldo</h2>
            </div>
            <StatusPill
              tone={explanation.matches_projection ? "success" : "danger"}
            >
              {explanation.categories.reduce(
                (total, category) => total + category.movement_count,
                0,
              )}{" "}
              pergerakan
            </StatusPill>
          </div>
          <p className="section-description">
            Nilai positif menambah stok dan nilai negatif mengurangi stok.
            Setiap pergerakan dapat ditelusuri kembali ke transaksi asalnya.
          </p>

          <div className="balance-category-list">
            {explanation.categories.map((category, index) => (
              <details
                className="balance-category"
                key={category.key}
                open={category.movement_count > 0}
              >
                <summary>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{category.label}</strong>
                    <small>{category.description}</small>
                  </div>
                  <div>
                    <strong
                      className={
                        category.total_qty > 0
                          ? "quantity-positive"
                          : category.total_qty < 0
                            ? "quantity-negative"
                            : ""
                      }
                    >
                      {category.total_qty > 0 ? "+" : ""}
                      {formatQuantity(category.total_qty)}
                    </strong>
                    <small>{category.movement_count} pergerakan</small>
                  </div>
                </summary>

                {category.movements.length ? (
                  <div className="category-movements mt-4">
                    <Table className="min-w-[64rem]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pergerakan</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Sebelum → Sesudah</TableHead>
                          <TableHead>Perubahan</TableHead>
                          <TableHead>Waktu</TableHead>
                          <TableHead>Tindakan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {category.movements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>
                              <strong>{reasonLabel(movement.reason)}</strong>
                              <small>
                                {channelLabel(movement.channel)} ·{" "}
                                {movement.reference ?? "Tanpa referensi"}
                              </small>
                            </TableCell>
                            <TableCell>{movement.batch_code}</TableCell>
                            <TableCell>
                              {formatQuantity(movement.before_qty)} →{" "}
                              {formatQuantity(movement.after_qty)}
                            </TableCell>
                            <TableCell>
                              <strong
                                className={
                                  movement.qty_delta > 0
                                    ? "quantity-positive"
                                    : "quantity-negative"
                                }
                              >
                                {movement.qty_delta > 0 ? "+" : ""}
                                {formatQuantity(movement.qty_delta)}
                              </strong>
                            </TableCell>
                            <TableCell>{formatDateTime(movement.occurred_at)}</TableCell>
                            <TableCell>
                              <LinkButton
                                className="h-8 px-0"
                                href={`/ledger/${movement.command_id}`}
                                variant="link"
                              >
                                Bukti →
                              </LinkButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="empty-inline">
                    Belum ada pergerakan pada kategori ini.
                  </div>
                )}
              </details>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Riwayat vs saldo tersimpan</h2>
            </div>
            <StatusPill
              tone={
                explanation.batches.every((batch) => batch.matches_projection)
                  ? "success"
                  : "danger"
              }
            >
              {explanation.batches.every((batch) => batch.matches_projection)
                ? "Semua match"
                : "Ada drift"}
            </StatusPill>
          </div>

          <div className="mt-4">
            <Table className="min-w-[54rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Kedaluwarsa</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Saldo tersimpan</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {explanation.batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <strong>{batch.batch_code}</strong>
                    </TableCell>
                    <TableCell>{batchSourceLabel(batch.source_type)}</TableCell>
                    <TableCell>{formatDate(batch.expiry_date)}</TableCell>
                    <TableCell>{formatQuantity(batch.ledger_qty)}</TableCell>
                    <TableCell>{formatQuantity(batch.projection_qty)}</TableCell>
                    <TableCell>
                      <StatusPill
                        tone={batch.matches_projection ? "success" : "danger"}
                      >
                        {batch.matches_projection ? "Sesuai" : "Berbeda"}
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>
    </>
  );
}
