import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { getOperationsWorkspace } from "@/lib/data/operations";
import { formatDateTime, formatQuantity } from "@/lib/domain/inventory";

export default async function NotificationsPage() {
  const workspace = await getOperationsWorkspace();
  const critical = workspace.notifications.filter(
    (notification) => notification.severity === "CRITICAL",
  );
  const expiry = workspace.notifications.filter(
    (notification) => notification.type === "EXPIRY",
  );
  const claims = workspace.notifications.filter(
    (notification) => notification.type === "TIKTOK_CLAIM",
  );

  return (
    <>
      <PageHeader
        actions={
          <LinkButton className="h-11 px-5" href="/reconciliation" variant="outline">
            Rekonsiliasi
          </LinkButton>
        }
        description="Pantau batch yang mendekati kedaluwarsa dan batas waktu klaim retur TikTok."
        title="Notifikasi"
      />

      <div className="app-content">
        <section className="metric-grid operational-metrics">
          <MetricCard description="Peringatan yang sama tampil di dashboard" label="Aktif" value={formatQuantity(workspace.notifications.length)} />
          <MetricCard description="Melewati batas waktu atau kedaluwarsa dekat" label="Kritis" value={formatQuantity(critical.length)} />
          <MetricCard description="Batch aktif dengan stok positif" label="Batch mendekati kedaluwarsa" value={formatQuantity(expiry.length)} />
          <MetricCard description="Maksimal 10 hari tersisa" label="Klaim TikTok" value={formatQuantity(claims.length)} />
        </section>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Perlu perhatian</h2>
            </div>
            <StatusPill
              tone={workspace.notifications.length ? "warning" : "success"}
            >
              {workspace.notifications.length
                ? `${workspace.notifications.length} aktif`
                : "Tidak ada peringatan"}
            </StatusPill>
          </div>

          {workspace.notifications.length ? (
            <div className="notification-list">
              {workspace.notifications.map((notification) => (
                <article className="notification-card" key={notification.id}>
                  <span
                    className={`notification-mark severity-${notification.severity.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  <div>
                    <span className="preview-kicker">
                      {notification.type === "EXPIRY"
                        ? "Kedaluwarsa batch"
                        : "Klaim TikTok"}
                    </span>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>Batas waktu {formatDateTime(notification.due_at)}</small>
                  </div>
                  <StatusPill
                    tone={
                      notification.severity === "CRITICAL"
                        ? "danger"
                        : "warning"
                    }
                  >
                    {notification.severity}
                  </StatusPill>
                  {notification.product_id ? (
                    <LinkButton
                      className="h-8 px-0"
                      href={`/products/${notification.product_id}`}
                      variant="link"
                    >
                      Lihat batch →
                    </LinkButton>
                  ) : notification.return_id ? (
                    <LinkButton className="h-8 px-0" href="/returns" variant="link">
                      Buka retur →
                    </LinkButton>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Peringatan akan muncul otomatis dari kondisi batch dan retur."
              title="Tidak ada notifikasi aktif."
            />
          )}
        </Panel>
      </div>
    </>
  );
}
