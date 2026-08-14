import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { TechnicalDetails } from "@/components/technical-details";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMarketplaceEventReceipt } from "@/lib/data/marketplace";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
} from "@/lib/domain/inventory";
import {
  componentTypeLabel,
  marketplaceEventLabel,
  marketplaceOrderStatusLabel,
  marketplaceProcessingStatusLabel,
} from "@/lib/domain/marketplace";

export default async function MarketplaceEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const receipt = await getMarketplaceEventReceipt(id);

  if (!receipt?.event) {
    notFound();
  }

  return (
    <>
      <PageHeader
        actions={
          <LinkButton className="h-11 px-5" href="/marketplace" variant="outline">
            ← Riwayat event
          </LinkButton>
        }
        description="Telusuri event marketplace, order terkait, dan seluruh perubahan stok yang dihasilkan."
        context={`${receipt.event.source} · ${formatDateTime(
          receipt.event.received_at,
        )}`}
        title={receipt.event.external_event_id}
      />

      <div className="app-content receipt-page">
        <section className="receipt-hero marketplace-receipt-hero">
          <div>
            <span className="receipt-seal" aria-hidden="true">
              {receipt.outcome === "APPLIED"
                ? "✓"
                : receipt.outcome === "DUPLICATE"
                  ? "↺"
                  : "!"}
            </span>
            <div>
              <h2>{marketplaceEventLabel(receipt.event.event_type)}</h2>
              <p>
                {receipt.event.channel} ·{" "}
                {receipt.event.external_order_id}
              </p>
            </div>
          </div>
          <StatusPill
            tone={
              receipt.outcome === "APPLIED"
                ? "success"
                : receipt.outcome === "DUPLICATE"
                  ? "warning"
                  : "danger"
            }
          >
            {receipt.outcome === "APPLIED"
              ? "Berhasil"
              : receipt.outcome === "DUPLICATE"
                ? "Duplikat diabaikan"
                : "Ditolak"}
          </StatusPill>
        </section>

        {receipt.error ? (
          <Panel className="receipt-error">
            <h2>Aktivitas marketplace ditolak</h2>
            <p>
              Data ini belum dapat diproses. Periksa ID order, SKU marketplace,
              jumlah, dan urutan status, lalu kirim ulang.
            </p>
            <TechnicalDetails
              items={[
                { label: "Kode masalah", value: receipt.error.code },
                { label: "Pesan sistem", value: receipt.error.message },
              ]}
              summary="Lihat detail teknis penolakan"
            />
          </Panel>
        ) : null}

        <div className="receipt-meta-grid">
          <article>
            <span>Jenis event</span>
            <strong>{marketplaceEventLabel(receipt.event.event_type)}</strong>
          </article>
          <article>
            <span>Status pemrosesan</span>
            <strong>{marketplaceProcessingStatusLabel(receipt.event.processing_status)}</strong>
          </article>
          <article>
            <span>ID transaksi</span>
            <strong>{receipt.command_id ?? "Tidak membuat transaksi stok"}</strong>
          </article>
          <article>
            <span>Grup pergerakan</span>
            <strong>
              {receipt.movement_group_id ?? "Tidak ada pergerakan stok fisik"}
            </strong>
          </article>
        </div>

        {receipt.order ? (
          <Panel>
            <div className="section-heading">
              <div>
                <h2>{receipt.order.external_order_id}</h2>
              </div>
              <StatusPill tone="info">
                {marketplaceOrderStatusLabel(receipt.order.status)}
              </StatusPill>
            </div>
            <div className="event-order-items">
              {receipt.order.items.map((item) => (
                <article className="event-order-item" key={item.id}>
                  <div>
                    <span>{item.external_line_id}</span>
                    <strong>
                      {item.listing_sku} × {formatQuantity(item.ordered_qty)}
                    </strong>
                  </div>
                  <ul>
                    {item.components.map((component) => (
                      <li key={component.id}>
                        <span>
                          {component.product_sku} ·{" "}
                          {componentTypeLabel(component.component_type)}
                        </span>
                        <strong>
                          {formatQuantity(component.ordered_qty)} unit
                        </strong>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Pergerakan dari event ini</h2>
            </div>
            <span className="section-count">
              {formatQuantity(receipt.movements.length)} pergerakan
            </span>
          </div>

          {receipt.movements.length ? (
            <div className="mt-4">
              <Table className="min-w-[68rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Urutan</TableHead>
                    <TableHead>Produk</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Kedaluwarsa</TableHead>
                    <TableHead>Perubahan</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Koreksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipt.movements.map((movement) => (
                    <TableRow key={movement.movement_id}>
                      <TableCell>#{movement.sequence_no}</TableCell>
                      <TableCell>
                        <strong>{movement.product_sku}</strong>
                        <small>{movement.product_name}</small>
                      </TableCell>
                      <TableCell>{movement.batch_code}</TableCell>
                      <TableCell>{formatDate(movement.expiry_date)}</TableCell>
                      <TableCell
                        className={
                          movement.qty_delta > 0
                            ? "quantity-positive"
                            : "quantity-negative"
                        }
                      >
                        {movement.qty_delta > 0 ? "+" : ""}
                        {formatQuantity(movement.qty_delta)}
                      </TableCell>
                      <TableCell>
                        {formatQuantity(movement.balance_before)} →{" "}
                        {formatQuantity(movement.balance_after)}
                      </TableCell>
                      <TableCell>{movement.reason}</TableCell>
                      <TableCell>
                        {movement.reverses_movement_id ? "Tertaut" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              description="Order baru hanya mengalokasikan stok. Pembatalan sebelum pengiriman hanya melepaskan alokasi tersebut."
              title="Tidak ada pergerakan stok fisik."
            />
          )}
        </Panel>
      </div>
    </>
  );
}
