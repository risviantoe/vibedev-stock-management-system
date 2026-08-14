import { OpnameStartForm } from "@/components/forms/opname-start-form";
import { EmptyState } from "@/components/empty-state";
import { OpnameWorkspaceForm } from "@/components/forms/opname-workspace-form";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getActiveOpnameSession,
  getOpnameHistoryPage,
} from "@/lib/data/operations";
import { formatDateTime, formatQuantity } from "@/lib/domain/inventory";
import {
  parsePage,
  parsePageSize,
  type PaginationSearchParams,
} from "@/lib/pagination";

export default async function OpnamePage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const [active, history] = await Promise.all([
    getActiveOpnameSession(),
    getOpnameHistoryPage(page, pageSize),
  ]);
  const finalized = history.items;
  const savedCount =
    active?.counts.filter((count) => count.physical_qty !== null).length ?? 0;
  const varianceCount =
    active?.counts.filter((count) => (count.variance_qty ?? 0) !== 0).length ??
    0;

  return (
    <>
      <PageHeader
        description="Catat jumlah fisik setiap batch, tinjau selisih, lalu sesuaikan saldo setelah seluruh hitungan selesai."
        title="Stok Opname"
      />

      <div className="app-content">
        <section className="metric-grid operational-metrics">
          <MetricCard description={active ? "Draft sedang berlangsung" : "Tidak ada draft"} label="Sesi aktif" value={active ? "1" : "0"} />
          <MetricCard description="Saldo sistem saat sesi dimulai" label="Batch yang dihitung" value={formatQuantity(active?.counts.length ?? 0)} />
          <MetricCard description="Dapat diedit sebelum diselesaikan" label="Hitung tersimpan" value={formatQuantity(savedCount)} />
          <MetricCard description="Belum mengubah riwayat stok" label="Selisih sementara" value={formatQuantity(varianceCount)} />
        </section>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>{active ? "Hitung fisik per batch" : "Mulai opname baru"}</h2>
            </div>
            <StatusPill tone={active ? "warning" : "neutral"}>
              {active ? "Draft" : "Belum dimulai"}
            </StatusPill>
          </div>
          {active ? (
            <>
              <p className="section-description">
                Saldo awal dicatat {formatDateTime(active.started_at)}. Simpan
                seluruh hitung sebelum finalisasi.
              </p>
              <OpnameWorkspaceForm session={active} />
            </>
          ) : (
            <OpnameStartForm />
          )}
        </Panel>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Sesi yang sudah selesai</h2>
            </div>
            <span className="section-count">{history.total} sesi</span>
          </div>
          {finalized.length ? (
            <div className="mt-4">
              <Table className="min-w-[46rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Selisih</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalized.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{formatDateTime(session.started_at)}</TableCell>
                      <TableCell>
                        {session.finalized_at
                          ? formatDateTime(session.finalized_at)
                          : "—"}
                      </TableCell>
                      <TableCell>{formatQuantity(session.counts.length)}</TableCell>
                      <TableCell>
                        {formatQuantity(
                          session.counts.filter(
                            (count) => (count.variance_qty ?? 0) !== 0,
                          ).length,
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill tone="success">Selesai</StatusPill>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              description="Riwayat penyesuaian akan tampil setelah sesi pertama diselesaikan."
              title="Belum ada stok opname yang selesai."
            />
          )}
          <Pagination
            basePath="/opname"
            page={page}
            pageSize={pageSize}
            total={history.total}
          />
        </Panel>
      </div>
    </>
  );
}
