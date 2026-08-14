import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ReturnCreateForm } from "@/components/forms/return-create-form";
import { ReturnInspectionForm } from "@/components/forms/return-inspection-form";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { getOperationsWorkspace } from "@/lib/data/operations";
import {
  formatDateTime,
  formatQuantity,
} from "@/lib/domain/inventory";
import { returnConditionLabel } from "@/lib/domain/operations";

export default async function ReturnsPage() {
  const workspace = await getOperationsWorkspace();
  const pendingItems = workspace.returns.flatMap((itemReturn) =>
    itemReturn.items.filter((item) => item.inspection_status === "PENDING"),
  );
  const openClaims = workspace.returns.filter(
    (itemReturn) => itemReturn.claim_status === "OPEN",
  );
  const claimReminders = workspace.notifications.filter(
    (notification) => notification.type === "TIKTOK_CLAIM",
  );

  return (
    <>
      <PageHeader
        actions={
          <LinkButton className="h-11 px-5" href="/notifications" variant="outline">
            Notifikasi klaim
          </LinkButton>
        }
        description="Catat barang yang dikembalikan pelanggan, lalu tentukan kondisinya melalui inspeksi gudang."
        title="Retur & Inspeksi"
      />

      <div className="app-content">
        <section className="metric-grid operational-metrics">
          <MetricCard description="Terhubung ke order dan item sumber" label="Retur tercatat" value={formatQuantity(workspace.returns.length)} />
          <MetricCard description="Belum mempunyai keputusan kondisi" label="Menunggu inspeksi" value={formatQuantity(pendingItems.length)} />
          <MetricCard description="Selesai setelah seluruh barang diinspeksi" label="Klaim terbuka" value={formatQuantity(openClaims.length)} />
          <MetricCard description="Deadline maksimal 10 hari lagi" label="Reminder TikTok" value={formatQuantity(claimReminders.length)} />
        </section>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Catat barang yang kembali</h2>
            </div>
          </div>
          <p className="section-description">
            Quantity dibatasi oleh produk fisik yang benar-benar terkirim,
            termasuk komponen bundle dan bonus promo.
          </p>
          <ReturnCreateForm candidates={workspace.returnCandidates} />
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Inspeksi barang retur</h2>
            </div>
            <StatusPill tone={pendingItems.length ? "warning" : "success"}>
              {pendingItems.length
                ? `${pendingItems.length} menunggu`
                : "Semua selesai"}
            </StatusPill>
          </div>

          {workspace.returns.length ? (
            <div className="return-worklist">
              {workspace.returns.map((itemReturn) => (
                <article className="return-card" key={itemReturn.id}>
                  <div className="return-card-heading">
                    <div>
                      <span className="preview-kicker">
                        {itemReturn.channel} ·{" "}
                        {itemReturn.order?.external_order_id ?? "Order"}
                      </span>
                      <h3>{itemReturn.external_return_id}</h3>
                      <p>
                        Dibuat {formatDateTime(itemReturn.created_at)}
                        {itemReturn.remainingClaimDays !== null
                          ? ` · ${itemReturn.remainingClaimDays} hari klaim tersisa`
                          : ""}
                      </p>
                    </div>
                    <StatusPill
                      tone={
                        itemReturn.claim_status === "OPEN"
                          ? "warning"
                          : "success"
                      }
                    >
                      {itemReturn.claim_status === "OPEN"
                        ? "Klaim terbuka"
                        : "Selesai"}
                    </StatusPill>
                  </div>

                  <div className="return-item-list">
                    {itemReturn.items.map((item) => (
                      <section className="return-item-card" key={item.id}>
                        <div className="return-item-summary">
                          <div>
                            <strong>
                              {item.product?.sku} · {item.product?.name}
                            </strong>
                            <p>
                              {item.orderItem?.external_line_id} ·{" "}
                              {formatQuantity(item.qty)} unit
                            </p>
                          </div>
                          <StatusPill
                            tone={
                              item.inspection_status === "PENDING"
                                ? "warning"
                                : item.condition === "SELLABLE"
                                  ? "success"
                                  : "neutral"
                            }
                          >
                            {item.inspection_status === "PENDING"
                              ? "Menunggu inspeksi"
                              : item.condition
                                ? returnConditionLabel(item.condition)
                                : "Sudah diinspeksi"}
                          </StatusPill>
                        </div>

                        {item.inspection_status === "PENDING" ? (
                          <ReturnInspectionForm item={item} />
                        ) : (
                          <div className="inspection-result">
                            <strong>
                              {item.condition === "SELLABLE"
                                ? `Masuk batch ${item.returnBatch?.batch_code}`
                                : "Tidak ada perubahan stok tambahan"}
                            </strong>
                            <span>
                              {item.inspected_at
                                ? formatDateTime(item.inspected_at)
                                : "Selesai"}
                            </span>
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Retur yang dicatat akan masuk ke daftar inspeksi ini."
              title="Belum ada barang retur."
            />
          )}
        </Panel>
      </div>
    </>
  );
}
