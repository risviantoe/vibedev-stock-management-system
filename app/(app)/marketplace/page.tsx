import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { MarketplaceCsvForm } from "@/components/forms/marketplace-csv-form";
import { MarketplaceSimulatorForm } from "@/components/forms/marketplace-simulator-form";
import { OperationalTableToolbar } from "@/components/operational-table-toolbar";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getActiveMarketplaceListings,
  getMarketplaceDashboardSummary,
  getMarketplaceInboxPage,
  getMarketplaceOrdersPage,
} from "@/lib/data/marketplace";
import { formatDateTime, formatQuantity } from "@/lib/domain/inventory";
import {
  marketplaceEventLabel,
  marketplaceOrderStatusLabel,
  marketplaceProcessingStatusLabel,
  type MarketplaceOrderStatus,
  type MarketplaceProcessingStatus,
} from "@/lib/domain/marketplace";
import {
  DEFAULT_PAGE_SIZE,
  parsePage,
  parsePageSize,
  type PaginationSearchParams,
} from "@/lib/pagination";
import {
  hasActiveRetrieval,
  optionalQueryValue,
  parseMarketplaceEventRetrieval,
  parseMarketplaceOrderRetrieval,
} from "@/lib/retrieval";

function processingTone(
  status: MarketplaceProcessingStatus,
): "success" | "warning" | "danger" | "info" {
  if (status === "APPLIED") return "success";
  if (status === "DUPLICATE") return "warning";
  if (status === "REJECTED") return "danger";
  return "info";
}

function orderTone(
  status: MarketplaceOrderStatus,
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "RESERVED") return "warning";
  if (status === "SHIPPED" || status === "IN_TRANSIT") return "success";
  if (status === "PARTIALLY_CANCELLED") return "info";
  if (status === "CANCELLED") return "neutral";
  return "neutral";
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<PaginationSearchParams>;
}) {
  const params = await searchParams;
  const ordersPageNumber = parsePage(params.ordersPage);
  const eventsPageNumber = parsePage(params.eventsPage);
  const ordersPageSize = parsePageSize(params.ordersPageSize);
  const eventsPageSize = parsePageSize(params.eventsPageSize);
  const orderRetrieval = parseMarketplaceOrderRetrieval(params);
  const eventRetrieval = parseMarketplaceEventRetrieval(params);
  const [listings, ordersPage, eventsPage, summary] = await Promise.all([
    getActiveMarketplaceListings(),
    getMarketplaceOrdersPage(
      ordersPageNumber,
      ordersPageSize,
      orderRetrieval,
    ),
    getMarketplaceInboxPage(
      eventsPageNumber,
      eventsPageSize,
      eventRetrieval,
    ),
    getMarketplaceDashboardSummary(),
  ]);
  const hasOrderFilters = hasActiveRetrieval(
    {
      orderQ: orderRetrieval.search,
      orderChannel: orderRetrieval.channel,
      orderStatus: orderRetrieval.status,
      orderSort: orderRetrieval.sort,
    },
    {
      orderQ: "",
      orderChannel: "ALL",
      orderStatus: "ALL",
      orderSort: "UPDATED_DESC",
    },
  );
  const hasEventFilters = hasActiveRetrieval(
    {
      eventQ: eventRetrieval.search,
      eventChannel: eventRetrieval.channel,
      eventStatus: eventRetrieval.status,
      eventSort: eventRetrieval.sort,
    },
    {
      eventQ: "",
      eventChannel: "ALL",
      eventStatus: "ALL",
      eventSort: "RECEIVED_DESC",
    },
  );
  const orderFilterQuery = {
    orderQ: optionalQueryValue(orderRetrieval.search),
    orderChannel: optionalQueryValue(orderRetrieval.channel, "ALL"),
    orderStatus: optionalQueryValue(orderRetrieval.status, "ALL"),
    orderSort: optionalQueryValue(orderRetrieval.sort, "UPDATED_DESC"),
  };
  const eventFilterQuery = {
    eventQ: optionalQueryValue(eventRetrieval.search),
    eventChannel: optionalQueryValue(eventRetrieval.channel, "ALL"),
    eventStatus: optionalQueryValue(eventRetrieval.status, "ALL"),
    eventSort: optionalQueryValue(eventRetrieval.sort, "RECEIVED_DESC"),
  };

  return (
    <>
      <PageHeader
        actions={
          <LinkButton className="h-11 px-5" href="/promos" variant="outline">
            Bundle & promo
          </LinkButton>
        }
        description="Catat perubahan status order dan telusuri aktivitas marketplace. Stok dialokasikan saat order diterima lalu dikurangi saat barang dikirim."
        title="Order Marketplace"
      />

      <div className="app-content marketplace-workspace">
        <section className="metric-grid operational-metrics">
          <MetricCard description="Stok sudah dialokasikan untuk order" label="Menunggu pengiriman" value={formatQuantity(summary.reservedOrders)} />
          <MetricCard description="Termasuk pengiriman ulang dari channel" label="Event diterima" value={formatQuantity(eventsPage.total)} />
          <MetricCard description="Tidak mengubah stok untuk kedua kali" label="Event duplikat" value={formatQuantity(summary.duplicateAttempts)} />
          <MetricCard description="Tidak ada perubahan stok sebagian" label="Event ditolak" value={formatQuantity(summary.rejectedEvents)} />
        </section>

        <div className="marketplace-command-grid">
          <Panel className="command-panel">
            <div className="section-heading">
              <div>
                <h2>Catat perubahan status order</h2>
              </div>
            </div>
            <MarketplaceSimulatorForm listings={listings} />
          </Panel>

          <Panel className="command-panel">
            <div className="section-heading">
              <div>
                <h2>Periksa sebelum impor</h2>
              </div>
            </div>
            <MarketplaceCsvForm />
          </Panel>
        </div>

          <Panel id="order-list">
          <div className="section-heading">
            <div>
              <h2 id="marketplace-orders-heading">Order yang perlu dipantau</h2>
            </div>
            <span className="section-count">
              {formatQuantity(ordersPage.total)} order
            </span>
          </div>

          <OperationalTableToolbar
            anchor="order-list"
            fields={[
              {
                defaultValue: "ALL",
                label: "Channel",
                name: "orderChannel",
                options: [
                  { label: "Semua channel", value: "ALL" },
                  { label: "Shopee", value: "SHOPEE" },
                  { label: "TikTok", value: "TIKTOK" },
                ],
                value: orderRetrieval.channel,
              },
              {
                defaultValue: "ALL",
                label: "Tahap order",
                name: "orderStatus",
                options: [
                  { label: "Semua tahap", value: "ALL" },
                  { label: "Direservasi", value: "RESERVED" },
                  { label: "Dikirim", value: "SHIPPED" },
                  { label: "Dalam perjalanan", value: "IN_TRANSIT" },
                  { label: "Batal sebagian", value: "PARTIALLY_CANCELLED" },
                  { label: "Dibatalkan", value: "CANCELLED" },
                ],
                value: orderRetrieval.status,
              },
              {
                defaultValue: "UPDATED_DESC",
                label: "Urutkan",
                name: "orderSort",
                options: [
                  { label: "Aktivitas terbaru", value: "UPDATED_DESC" },
                  { label: "Order terbaru", value: "ORDERED_DESC" },
                ],
                value: orderRetrieval.sort,
              },
            ]}
            pageParam="ordersPage"
            searchLabel="Cari order"
            searchParam="orderQ"
            searchPlaceholder="ID order atau SKU listing"
            searchValue={orderRetrieval.search}
          />

          {ordersPage.items.length ? (
            <div className="mt-4">
              <Table aria-labelledby="marketplace-orders-heading" className="min-w-[74rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Unit dipesan</TableHead>
                    <TableHead>Dialokasikan</TableHead>
                    <TableHead>Dikirim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Terakhir berubah</TableHead>
                    <TableHead>Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersPage.items.map((order) => {
                    const ordered = order.items.reduce(
                      (total, item) => total + item.ordered_qty,
                      0,
                    );
                    const reserved = order.items.reduce(
                      (total, item) => total + item.reserved_qty,
                      0,
                    );
                    const shipped = order.items.reduce(
                      (total, item) => total + item.shipped_qty,
                      0,
                    );
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="stacked-cell">
                            <strong className="identifier">
                              {order.external_order_id}
                            </strong>
                            <small>{formatDateTime(order.ordered_at)}</small>
                          </div>
                        </TableCell>
                        <TableCell>{order.channel}</TableCell>
                        <TableCell>{formatQuantity(ordered)}</TableCell>
                        <TableCell>{formatQuantity(reserved)}</TableCell>
                        <TableCell>{formatQuantity(shipped)}</TableCell>
                        <TableCell>
                          <StatusPill tone={orderTone(order.status)}>
                            {marketplaceOrderStatusLabel(order.status)}
                          </StatusPill>
                        </TableCell>
                        <TableCell>{formatDateTime(order.updated_at)}</TableCell>
                        <TableCell>
                          <LinkButton
                            className="h-8 px-0"
                            href={`/marketplace/orders/${order.id}`}
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
                hasOrderFilters
                  ? "Ubah pencarian, filter, atau urutan untuk melihat order lain."
                  : "Catat order baru secara manual atau impor melalui CSV."
              }
              title={
                hasOrderFilters
                  ? "Tidak ada order yang cocok."
                  : "Belum ada order marketplace."
              }
            />
          )}
          <Pagination
            anchor="order-list"
            basePath="/marketplace"
            page={ordersPageNumber}
            pageParam="ordersPage"
            pageSize={ordersPageSize}
            pageSizeParam="ordersPageSize"
            query={{
              ...orderFilterQuery,
              ...eventFilterQuery,
              eventsPage: eventsPageNumber > 1 ? eventsPageNumber : undefined,
              eventsPageSize:
                eventsPageSize === DEFAULT_PAGE_SIZE
                  ? undefined
                  : eventsPageSize,
            }}
            total={ordersPage.total}
          />
          </Panel>

          <Panel id="event-inbox">
          <div className="section-heading">
            <div>
              <h2 id="marketplace-events-heading">Riwayat event</h2>
            </div>
            <span className="section-count">
              {formatQuantity(eventsPage.total)} event
            </span>
          </div>

          <OperationalTableToolbar
            anchor="event-inbox"
            fields={[
              {
                defaultValue: "ALL",
                label: "Channel",
                name: "eventChannel",
                options: [
                  { label: "Semua channel", value: "ALL" },
                  { label: "Shopee", value: "SHOPEE" },
                  { label: "TikTok", value: "TIKTOK" },
                ],
                value: eventRetrieval.channel,
              },
              {
                defaultValue: "ALL",
                label: "Hasil pemrosesan",
                name: "eventStatus",
                options: [
                  { label: "Semua hasil", value: "ALL" },
                  { label: "Diterima", value: "RECEIVED" },
                  { label: "Diproses", value: "APPLIED" },
                  { label: "Duplikat diabaikan", value: "DUPLICATE" },
                  { label: "Ditolak", value: "REJECTED" },
                ],
                value: eventRetrieval.status,
              },
              {
                defaultValue: "RECEIVED_DESC",
                label: "Urutkan",
                name: "eventSort",
                options: [
                  { label: "Event terbaru", value: "RECEIVED_DESC" },
                  { label: "Event terlama", value: "RECEIVED_ASC" },
                ],
                value: eventRetrieval.sort,
              },
            ]}
            pageParam="eventsPage"
            searchLabel="Cari event"
            searchParam="eventQ"
            searchPlaceholder="ID event atau ID order"
            searchValue={eventRetrieval.search}
          />

          {eventsPage.items.length ? (
            <div className="mt-4">
              <Table aria-labelledby="marketplace-events-heading" className="min-w-[82rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Diterima</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Sumber</TableHead>
                    <TableHead>Percobaan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsPage.items.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{formatDateTime(attempt.received_at)}</TableCell>
                      <TableCell>
                        <div className="stacked-cell">
                          <strong>
                            {attempt.event
                              ? marketplaceEventLabel(attempt.event.event_type)
                              : "Event"}
                          </strong>
                          <small className="identifier">
                            {attempt.event?.external_event_id ?? "Tidak tersedia"}
                          </small>
                        </div>
                      </TableCell>
                      <TableCell>{attempt.event?.external_order_id ?? "—"}</TableCell>
                      <TableCell>{attempt.event?.source ?? "—"}</TableCell>
                      <TableCell>#{attempt.attempt_no}</TableCell>
                      <TableCell>
                        <StatusPill
                          tone={processingTone(attempt.processing_status)}
                        >
                          {marketplaceProcessingStatusLabel(attempt.processing_status)}
                        </StatusPill>
                      </TableCell>
                      <TableCell>
                        {attempt.error_message ??
                          (attempt.processing_status === "DUPLICATE"
                            ? "Event yang sama sudah pernah diproses; stok tidak diubah."
                            : "Berhasil diproses.")}
                      </TableCell>
                      <TableCell>
                        {attempt.event ? (
                          <LinkButton
                            className="h-8 px-0"
                            href={`/marketplace/events/${attempt.event.id}`}
                            variant="link"
                          >
                            Detail →
                          </LinkButton>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              description={
                hasEventFilters
                  ? "Ubah pencarian, filter, atau urutan untuk melihat event lain."
                  : "Setiap perubahan status order manual dan impor CSV akan tercatat di sini."
              }
              title={
                hasEventFilters
                  ? "Tidak ada event yang cocok."
                  : "Belum ada riwayat event marketplace."
              }
            />
          )}
          <Pagination
            anchor="event-inbox"
            basePath="/marketplace"
            page={eventsPageNumber}
            pageParam="eventsPage"
            pageSize={eventsPageSize}
            pageSizeParam="eventsPageSize"
            query={{
              ...orderFilterQuery,
              ...eventFilterQuery,
              ordersPage: ordersPageNumber > 1 ? ordersPageNumber : undefined,
              ordersPageSize:
                ordersPageSize === DEFAULT_PAGE_SIZE
                  ? undefined
                  : ordersPageSize,
            }}
            total={eventsPage.total}
          />
          </Panel>
      </div>
    </>
  );
}
