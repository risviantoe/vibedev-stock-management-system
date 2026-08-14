import { InboundForm } from "@/components/forms/inbound-form";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { getInventorySnapshot } from "@/lib/data/inventory";

export default async function InboundPage() {
  const products = await getInventorySnapshot();

  return (
    <>
      <PageHeader
        description="Terima hasil produksi ke batch yang sudah ada atau buat batch baru. Perubahan saldo tersimpan sebagai satu transaksi."
        title="Barang Masuk"
      />
      <div className="app-content single-column-content">
        <Panel>
          <div className="section-heading">
            <div>
              <h2>Dokumen penerimaan</h2>
            </div>
          </div>
          <InboundForm products={products} />
        </Panel>
      </div>
    </>
  );
}
