import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { CircleCheck, PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import {
  formatDateTime,
  formatQuantity,
  reasonLabel,
} from "@/lib/domain/inventory";
import {
  getInventorySnapshot,
  getLedgerEntries,
} from "@/lib/data/inventory";
import { getMarketplaceDashboardSummary } from "@/lib/data/marketplace";
import { getOperationsDashboardSummary } from "@/lib/data/operations";

export default async function DashboardPage() {
  const [
    products,
    recentMovements,
    marketplaceSummary,
    operationsSummary,
  ] = await Promise.all([
    getInventorySnapshot(),
    getLedgerEntries(6),
    getMarketplaceDashboardSummary(),
    getOperationsDashboardSummary(),
  ]);
  const activeProducts = products.filter((product) => product.is_active);
  const batches = products.flatMap((product) =>
    product.batches.map((batch) => ({ ...batch, product })),
  );
  const expiryNotifications = operationsSummary.notifications.filter(
    (notification) => notification.type === "EXPIRY",
  );
  const unverifiedOpenings = batches.filter(
    (batch) =>
      batch.openingBalance?.verification_status === "UNVERIFIED",
  );
  const lowStockProducts = activeProducts.filter(
    (product) => product.availableQty > 0 && product.availableQty <= 5,
  );
  const totalReserved = products.reduce(
    (total, product) => total + product.reservedQty,
    0,
  );
  const totalAvailable = products.reduce(
    (total, product) => total + product.availableQty,
    0,
  );
  const tasks = [
    ...(operationsSummary.openAnomalies
      ? [
          {
            id: "reconciliation-anomalies",
            severity: "danger" as const,
            title: `${operationsSummary.openAnomalies} perbedaan data perlu diperiksa`,
            detail: "Tinjau rekonsiliasi dan sumber transaksi terkait",
            href: "/reconciliation",
            action: "Tinjau data",
          },
        ]
      : []),
    ...(operationsSummary.pendingReturnItems
      ? [
          {
            id: "pending-return-inspection",
            severity: "warning" as const,
            title: `${operationsSummary.pendingReturnItems} barang retur menunggu inspeksi`,
            detail: "Tentukan layak jual, rusak, atau hilang",
            href: "/returns",
            action: "Inspeksi retur",
          },
        ]
      : []),
    ...(operationsSummary.activeOpname
      ? [
          {
            id: "active-opname",
            severity: "info" as const,
            title: "Sesi opname draft sedang berlangsung",
            detail: "Selesaikan hitung fisik sebelum transaksi stok berikutnya",
            href: "/opname",
            action: "Lanjutkan opname",
          },
        ]
      : []),
    ...(marketplaceSummary.rejectedEvents
      ? [
          {
            id: "marketplace-rejected",
            severity: "danger" as const,
            title: `${marketplaceSummary.rejectedEvents} event marketplace ditolak`,
            detail: "Tinjau riwayat event untuk melihat penyebab penolakan dan data pesanan.",
            href: "/marketplace",
            action: "Tinjau event",
          },
        ]
      : []),
    ...(marketplaceSummary.reservedOrders
      ? [
          {
            id: "marketplace-reserved",
            severity: "info" as const,
            title: `${marketplaceSummary.reservedOrders} order menunggu pengiriman`,
            detail: `${formatQuantity(totalReserved)} unit sedang dialokasikan untuk order`,
            href: "/marketplace",
            action: "Proses order",
          },
        ]
      : []),
    ...operationsSummary.notifications.map((notification) => ({
      id: notification.id,
      severity:
        notification.severity === "CRITICAL"
          ? ("danger" as const)
          : ("warning" as const),
      title: notification.title,
      detail: notification.message,
      href: notification.product_id
        ? `/products/${notification.product_id}`
        : "/returns",
      action:
        notification.type === "EXPIRY" ? "Lihat batch" : "Buka retur",
    })),
    ...unverifiedOpenings.map((batch) => ({
      id: `opening-${batch.id}`,
      severity: "info" as const,
      title: `Saldo awal ${batch.product.sku} belum terverifikasi`,
      detail: `${batch.batch_code} · menunggu opname pertama`,
      href: `/products/${batch.product.id}`,
      action: "Lihat detail",
    })),
    ...lowStockProducts.map((product) => ({
      id: `low-${product.id}`,
      severity: "warning" as const,
      title: `${product.sku} tinggal ${product.onHandQty} unit`,
      detail: "Pertimbangkan penerimaan stok berikutnya",
      href: "/inbound",
      action: "Barang masuk",
    })),
  ].slice(0, 8);

  return (
    <>
      <PageHeader
        actions={
          <LinkButton className="h-11 px-5" href="/inbound">
            Catat barang masuk
          </LinkButton>
        }
        description="Prioritas operasional yang diturunkan langsung dari kondisi stok."
        title="Tugas Hari Ini"
      />

      <div className="app-content">
        <section className="metric-grid operational-metrics">
          <MetricCard
            description={`${products.length} produk tercatat`}
            label="SKU aktif"
            value={activeProducts.length}
          />
          <MetricCard
            description={
              <>
                {formatQuantity(totalReserved)} dialokasikan ·{" "}
                {formatQuantity(totalAvailable)} tersedia
              </>
            }
            label="Stok fisik"
            value={formatQuantity(
                products.reduce(
                  (total, product) => total + product.onHandQty,
                  0,
                ),
              )}
          />
          <MetricCard
            description="Batch yang perlu segera diperiksa"
            label="Kedaluwarsa ≤ 90 hari"
            value={expiryNotifications.length}
          />
          <MetricCard
            description="Diverifikasi pada opname pertama"
            label="Saldo awal belum diverifikasi"
            value={unverifiedOpenings.length}
          />
        </section>

        <div className="dashboard-columns">
          <Panel>
            <div className="section-heading">
              <div>
                <h2>Perlu ditindaklanjuti</h2>
              </div>
              <StatusPill tone={tasks.length ? "warning" : "success"}>
                {tasks.length ? `${tasks.length} tugas` : "Semua beres"}
              </StatusPill>
            </div>

            {tasks.length ? (
              <div className="task-list">
                {tasks.map((task) => (
                  <article className="task-row" key={task.id}>
                    <span
                      className={`severity-mark severity-${task.severity}`}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.detail}</p>
                    </div>
                    <Link href={task.href}>{task.action} →</Link>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Tugas baru akan muncul otomatis ketika ada kondisi yang perlu ditangani."
                icon={<CircleCheck aria-hidden="true" />}
                title="Semua aman untuk saat ini."
              />
            )}
          </Panel>

          <Panel>
            <div className="section-heading">
              <div>
                <h2>Pergerakan terakhir</h2>
              </div>
              <Link className="text-link" href="/ledger">
                Lihat semua
              </Link>
            </div>

            {recentMovements.length ? (
              <div className="movement-list">
                {recentMovements.map((movement) => (
                  <Link
                    className="movement-row"
                    href={
                      movement.command
                        ? `/ledger/${movement.command.id}`
                        : "/ledger"
                    }
                    key={movement.id}
                  >
                    <span
                      className={`movement-sign ${
                        movement.qty_delta > 0 ? "positive" : "negative"
                      }`}
                    >
                      {movement.qty_delta > 0 ? "+" : "−"}
                    </span>
                    <div>
                      <strong>
                        {movement.product?.sku ?? "Produk"} ·{" "}
                        {movement.batch?.batch_code ?? "Batch"}
                      </strong>
                      <p>
                        {reasonLabel(movement.reason)} ·{" "}
                        {formatDateTime(movement.occurred_at)}
                      </p>
                    </div>
                    <b>
                      {movement.qty_delta > 0 ? "+" : ""}
                      {formatQuantity(movement.qty_delta)}
                    </b>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Mulai dari saldo awal atau penerimaan barang."
                icon={<PackageOpen aria-hidden="true" />}
                title="Belum ada pergerakan stok."
              />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
