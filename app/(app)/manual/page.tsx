import { ManualOutboundForm } from "@/components/forms/manual-outbound-form";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { getInventorySnapshot } from "@/lib/data/inventory";

export default async function ManualOutboundPage() {
  const products = await getInventorySnapshot();

  return (
    <>
      <PageHeader
        description="Catat penjualan offline, bonus, promo, sampel, rusak, dan kedaluwarsa. Sistem memilih batch secara FEFO dan mencegah stok minus."
        title="Barang Keluar"
      />
      <div className="app-content single-column-content">
        <Panel>
          <div className="section-heading">
            <div>
              <h2>Catat barang keluar</h2>
            </div>
          </div>
          <ManualOutboundForm products={products} />
        </Panel>
      </div>
    </>
  );
}
