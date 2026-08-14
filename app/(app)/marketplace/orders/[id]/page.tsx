import { LinkButton } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { MarketplaceSimulatorForm } from "@/components/forms/marketplace-simulator-form";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { getMarketplaceWorkspace } from "@/lib/data/marketplace";
import {
  formatDateTime,
  formatQuantity,
} from "@/lib/domain/inventory";
import {
  componentTypeLabel,
  listingTypeLabel,
  marketplaceOrderStatusLabel,
} from "@/lib/domain/marketplace";

export default async function MarketplaceOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getMarketplaceWorkspace();
  const order = workspace.orders.find((item) => item.id === id) ?? null;

  if (!order) {
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
        description="Snapshot fisik order menjadi kontrak untuk reservasi, shipment, dan reversal."
        context={`${order.channel} · ${formatDateTime(order.ordered_at)}`}
        title={order.external_order_id}
      />

      <div className="app-content">
        <section className="order-hero panel">
          <div>
            <h2>{marketplaceOrderStatusLabel(order.status)}</h2>
            <p>
              {order.items.length} line · terakhir berubah{" "}
              {formatDateTime(order.updated_at)}
            </p>
          </div>
          <StatusPill
            tone={
              order.status === "RESERVED"
                ? "warning"
                : order.status === "CANCELLED"
                  ? "neutral"
                  : "success"
            }
          >
            {order.status}
          </StatusPill>
        </section>

        <div className="order-detail-grid">
          <Panel>
            <div className="section-heading">
              <div>
                <h2>Item & komponen fisik</h2>
              </div>
            </div>
            <div className="order-item-stack">
              {order.items.map((item) => (
                <article className="order-item-card" key={item.id}>
                  <div className="order-item-heading">
                    <div>
                      <span>{item.external_line_id}</span>
                      <strong>{item.listing_sku}</strong>
                    </div>
                    <StatusPill tone="info">
                      {listingTypeLabel(item.listing_type)}
                    </StatusPill>
                  </div>
                  <div className="allocation-summary">
                    <span>
                      Dipesan <strong>{formatQuantity(item.ordered_qty)}</strong>
                    </span>
                    <span>
                      Dialokasikan{" "}
                      <strong>{formatQuantity(item.reserved_qty)}</strong>
                    </span>
                    <span>
                      Dikirim <strong>{formatQuantity(item.shipped_qty)}</strong>
                    </span>
                    <span>
                      Dibatalkan{" "}
                      <strong>{formatQuantity(item.cancelled_qty)}</strong>
                    </span>
                  </div>
                  <div className="component-stack">
                    {item.components.map((component) => (
                      <div className="component-row" key={component.id}>
                        <span
                          className={`component-mark component-${component.component_type.toLowerCase()}`}
                          aria-hidden="true"
                        />
                        <div>
                          <strong>
                            {component.product?.sku} ·{" "}
                            {component.product?.name}
                          </strong>
                          <p>
                            {componentTypeLabel(component.component_type)}
                            {component.recipe_version_id
                              ? ` · recipe ${String(
                                  component.snapshot.recipe_version ?? "snapshot",
                                )}`
                              : ""}
                            {component.promo_rule_id
                              ? ` · ${String(
                                  component.snapshot.promo_name ?? "promo",
                                )}`
                              : ""}
                          </p>
                        </div>
                        <span>
                          {formatQuantity(component.ordered_component_qty)} unit
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel className="order-action-panel">
            <div className="section-heading">
              <div>
                <h2>Proses order ini</h2>
              </div>
            </div>
            <MarketplaceSimulatorForm
              compact
              initialChannel={order.channel}
              initialEventType={
                order.status === "RESERVED" ||
                order.status === "PARTIALLY_CANCELLED"
                  ? "ORDER_SHIPPED"
                  : "ORDER_CANCELLED"
              }
              initialOrderId={order.external_order_id}
              listings={workspace.listings}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
