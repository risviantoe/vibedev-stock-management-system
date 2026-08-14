import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { CorrectionButton } from "@/components/forms/correction-button";
import { OperationalTableToolbar } from "@/components/operational-table-toolbar";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  commandLabel,
  channelLabel,
  formatDateTime,
  formatQuantity,
  reasonLabel,
} from "@/lib/domain/inventory";
import { getLedgerEntriesPage } from "@/lib/data/inventory";
import { STOCK_REASONS } from "@/lib/domain/stock";
import {
  parsePage,
  parsePageSize,
  type PaginationSearchParams,
} from "@/lib/pagination";
import {
  hasActiveRetrieval,
  optionalQueryValue,
  parseLedgerRetrieval,
} from "@/lib/retrieval";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const retrieval = parseLedgerRetrieval(params);
  const result = await getLedgerEntriesPage(page, pageSize, retrieval);
  const entries = result.items;
  const hasFilters = hasActiveRetrieval(
    {
      q: retrieval.search,
      from: retrieval.from,
      to: retrieval.to,
      reason: retrieval.reason,
      channel: retrieval.channel,
      status: retrieval.status,
      sort: retrieval.sort,
    },
    {
      q: "",
      from: "",
      to: "",
      reason: "ALL",
      channel: "ALL",
      status: "ALL",
      sort: "OCCURRED_DESC",
    },
  );

  return (
    <>
      <PageHeader
        description="Telusuri seluruh barang masuk dan keluar. Koreksi disimpan sebagai catatan pembalik tanpa menghapus riwayat lama."
        title="Riwayat Stok"
      />
      <div className="app-content">
        <Panel>
          <div className="section-heading">
            <div>
              <h2 id="ledger-table-heading">{formatQuantity(result.total)} pergerakan stok</h2>
            </div>
          </div>

          <OperationalTableToolbar
            fields={[
              {
                defaultValue: "",
                kind: "date",
                label: "Dari tanggal",
                name: "from",
                value: retrieval.from,
              },
              {
                defaultValue: "",
                kind: "date",
                label: "Sampai tanggal",
                name: "to",
                value: retrieval.to,
              },
              {
                defaultValue: "ALL",
                label: "Alasan",
                name: "reason",
                options: [
                  { label: "Semua alasan", value: "ALL" },
                  ...STOCK_REASONS.map((reason) => ({
                    label: reasonLabel(reason),
                    value: reason,
                  })),
                ],
                value: retrieval.reason,
              },
              {
                defaultValue: "ALL",
                label: "Sumber",
                name: "channel",
                options: [
                  { label: "Semua sumber", value: "ALL" },
                  { label: "Shopee", value: "SHOPEE" },
                  { label: "TikTok", value: "TIKTOK" },
                  { label: "Penjualan langsung", value: "OFFLINE" },
                  { label: "Gudang", value: "INTERNAL" },
                ],
                value: retrieval.channel,
              },
              {
                defaultValue: "ALL",
                label: "Status catatan",
                name: "status",
                options: [
                  { label: "Semua status", value: "ALL" },
                  { label: "Final", value: "FINAL" },
                  { label: "Catatan koreksi", value: "CORRECTION" },
                  { label: "Sudah dikoreksi", value: "REVERSED" },
                ],
                value: retrieval.status,
              },
              {
                defaultValue: "OCCURRED_DESC",
                label: "Urutkan",
                name: "sort",
                options: [
                  { label: "Terbaru", value: "OCCURRED_DESC" },
                  { label: "Terlama", value: "OCCURRED_ASC" },
                ],
                value: retrieval.sort,
              },
            ]}
            searchLabel="Cari riwayat stok"
            searchParam="q"
            searchPlaceholder="Nomor pergerakan, SKU, batch, atau referensi"
            searchValue={retrieval.search}
          />

          {entries.length ? (
            <div className="mt-4">
              <Table aria-labelledby="ledger-table-heading" className="min-w-[72rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead># / Waktu</TableHead>
                    <TableHead>Produk / Batch</TableHead>
                    <TableHead>Alasan / Sumber</TableHead>
                    <TableHead>Transaksi</TableHead>
                    <TableHead className="text-right">Perubahan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <div className="primary-cell">
                          <strong className="identifier">#{movement.sequence_no}</strong>
                          <span>{formatDateTime(movement.occurred_at)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="primary-cell">
                          <strong className="identifier">
                            {movement.product?.sku ?? "—"}
                          </strong>
                          <span className="identifier">
                            {movement.batch?.batch_code ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="primary-cell">
                          <strong>{reasonLabel(movement.reason)}</strong>
                          <span>{channelLabel(movement.channel)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {movement.command ? (
                          <Link
                            className="text-link"
                            href={`/ledger/${movement.command.id}`}
                          >
                            {commandLabel(movement.command.command_type)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums quantity-delta ${
                          movement.qty_delta > 0 ? "positive" : "negative"
                        }`}
                      >
                        {movement.qty_delta > 0 ? "+" : ""}
                        {formatQuantity(movement.qty_delta)}
                      </TableCell>
                      <TableCell>
                        {movement.isReversed ? (
                          <StatusPill tone="neutral">Sudah dikoreksi</StatusPill>
                        ) : movement.reverses_movement_id ? (
                          <StatusPill tone="info">Catatan koreksi</StatusPill>
                        ) : (
                          <StatusPill tone="success">Final</StatusPill>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <CorrectionButton movement={movement} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              description={
                hasFilters
                  ? "Ubah pencarian, filter, atau urutan untuk melihat catatan lain."
                  : "Catat saldo awal atau barang masuk untuk membuat riwayat pertama."
              }
              title={
                hasFilters
                  ? "Tidak ada pergerakan yang cocok."
                  : "Riwayat stok masih kosong."
              }
            />
          )}
          <Pagination
            basePath="/ledger"
            page={page}
            pageSize={pageSize}
            query={{
              q: optionalQueryValue(retrieval.search),
              from: optionalQueryValue(retrieval.from),
              to: optionalQueryValue(retrieval.to),
              reason: optionalQueryValue(retrieval.reason, "ALL"),
              channel: optionalQueryValue(retrieval.channel, "ALL"),
              status: optionalQueryValue(retrieval.status, "ALL"),
              sort: optionalQueryValue(retrieval.sort, "OCCURRED_DESC"),
            }}
            total={result.total}
          />
        </Panel>
      </div>
    </>
  );
}
