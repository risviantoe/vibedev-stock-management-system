import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ReconciliationRunForm } from "@/components/forms/reconciliation-run-form";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { TechnicalDetails } from "@/components/technical-details";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getAnomaliesPage,
  getReconciliationSummary,
} from "@/lib/data/operations";
import { formatDateTime, formatQuantity } from "@/lib/domain/inventory";
import {
  anomalyEvidenceLabel,
  anomalyOperatorCopy,
  anomalySeverityLabel,
  anomalyStatusLabel,
  anomalyTypeLabel,
  type AnomalySeverity,
} from "@/lib/domain/operations";
import {
  parsePage,
  parsePageSize,
  type PaginationSearchParams,
} from "@/lib/pagination";

function severityTone(
  severity: AnomalySeverity,
): "danger" | "warning" | "info" {
  if (severity === "CRITICAL") return "danger";
  if (severity === "WARNING") return "warning";
  return "info";
}

function evidenceValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const [anomalies, summary] = await Promise.all([
    getAnomaliesPage(page, pageSize),
    getReconciliationSummary(),
  ]);

  return (
    <>
      <PageHeader
        description="Cocokkan saldo, riwayat stok, order, event, dan retur untuk menemukan data yang perlu ditinjau."
        title="Rekonsiliasi"
      />

      <div className="app-content">
        <section className="metric-grid metric-grid-three operational-metrics">
          <MetricCard description="Perlu ditinjau operator" label="Perbedaan data terbuka" value={formatQuantity(summary.open)} />
          <MetricCard description="Dapat memengaruhi ketepatan saldo stok" label="Kritis" value={formatQuantity(summary.critical)} />
          <MetricCard description="Ditampilkan juga di Tugas Hari Ini" label="Notifikasi aktif" value={formatQuantity(summary.notifications)} />
        </section>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Jalankan rekonsiliasi</h2>
            </div>
            <StatusPill tone="info">Tidak mengubah stok</StatusPill>
          </div>
          <ReconciliationRunForm />
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Data yang perlu ditinjau</h2>
            </div>
            <StatusPill tone={summary.open ? "warning" : "success"}>
              {summary.open ? `${summary.open} terbuka` : "Tidak ada masalah"}
            </StatusPill>
          </div>

          {anomalies.items.length ? (
            <div className="mt-4">
              <Table className="min-w-[84rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pemeriksaan</TableHead>
                    <TableHead>Prioritas</TableHead>
                    <TableHead>Penanganan</TableHead>
                    <TableHead>Masalah dan tindakan</TableHead>
                    <TableHead>Bukti teknis</TableHead>
                    <TableHead>Diperiksa terakhir</TableHead>
                    <TableHead>Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.items.map((anomaly) => {
                    const operatorCopy = anomalyOperatorCopy(anomaly.type);

                    return (
                      <TableRow key={anomaly.id}>
                        <TableCell>
                          <strong>{anomalyTypeLabel(anomaly.type)}</strong>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={severityTone(anomaly.severity)}>
                            {anomalySeverityLabel(anomaly.severity)}
                          </StatusPill>
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            tone={
                              anomaly.status === "OPEN" ? "warning" : "success"
                            }
                          >
                            {anomalyStatusLabel(anomaly.status)}
                          </StatusPill>
                        </TableCell>
                        <TableCell>
                          <div className="anomaly-guidance">
                            <strong>{operatorCopy.explanation}</strong>
                            <p>{operatorCopy.action}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TechnicalDetails
                            items={[
                              {
                                label: "ID pemeriksaan",
                                value: anomaly.fingerprint,
                              },
                              {
                                label: "Jenis pemeriksaan",
                                value: anomaly.type,
                              },
                              {
                                label: "Pesan sistem",
                                value: anomaly.explanation,
                              },
                              ...Object.entries(anomaly.evidence).map(
                                ([key, value]) => ({
                                  label: anomalyEvidenceLabel(key),
                                  value: evidenceValue(value),
                                }),
                              ),
                            ]}
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(anomaly.last_detected_at)}</TableCell>
                        <TableCell>
                          {anomaly.order_id ? (
                            <LinkButton
                              className="h-8 px-0"
                              href={`/marketplace/orders/${anomaly.order_id}`}
                              variant="link"
                            >
                              Buka order
                            </LinkButton>
                          ) : anomaly.product_id ? (
                            <LinkButton
                              className="h-8 px-0"
                              href={`/products/${anomaly.product_id}`}
                              variant="link"
                            >
                              Buka produk
                            </LinkButton>
                          ) : anomaly.movement_id ? (
                            <LinkButton className="h-8 px-0" href="/ledger" variant="link">
                              Buka riwayat stok
                            </LinkButton>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              description="Jalankan pemeriksaan untuk memastikan kondisi terbaru."
              title="Tidak ada perbedaan data yang tercatat."
            />
          )}
          <Pagination
            basePath="/reconciliation"
            page={page}
            pageSize={pageSize}
            total={anomalies.total}
          />
        </Panel>
      </div>
    </>
  );
}
