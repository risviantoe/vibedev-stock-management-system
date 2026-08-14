import { LinkButton } from "@/components/ui/button";
import { BundleRecipeForm } from "@/components/forms/bundle-recipe-form";
import { PromoRuleForm } from "@/components/forms/promo-rule-form";
import { BundleExpandableTable } from "@/components/tables/bundle-expandable-table";
import { PromoExpandableTable } from "@/components/tables/promo-expandable-table";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { getMarketplaceWorkspace } from "@/lib/data/marketplace";
import { formatQuantity } from "@/lib/domain/inventory";

export default async function PromosPage() {
  const workspace = await getMarketplaceWorkspace();

  return (
    <>
      <PageHeader
        actions={
          <LinkButton className="h-11 px-5" href="/marketplace" variant="outline">
            Order marketplace
          </LinkButton>
        }
        description="Atur isi bundle dan bonus promo untuk order berikutnya. Susunan setiap order yang sudah tercatat tidak ikut berubah."
        title="Bundle & Promo"
      />

      <div className="app-content">
        <div className="marketplace-command-grid balanced-command-grid">
          <Panel className="command-panel">
            <div className="border-b border-border pb-3 mb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Buat versi baru</h2>
            </div>
            <BundleRecipeForm products={workspace.products} />
          </Panel>

          <Panel className="command-panel">
            <div className="border-b border-border pb-3 mb-4">
              <h2 className="text-lg font-semibold text-card-foreground">Buat aturan bonus</h2>
            </div>
            <PromoRuleForm products={workspace.products} />
          </Panel>
        </div>

        <div className="mt-6 grid gap-6">
          <Panel>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">Daftar Susunan Bundle</h2>
                <p className="text-xs text-muted-foreground">
                  Klik baris bundle untuk melihat atau menyembunyikan rincian komponen fisik.
                </p>
              </div>
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {formatQuantity(workspace.bundles.length)} bundle
              </span>
            </div>
            <BundleExpandableTable bundles={workspace.bundles} />
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">Daftar Aturan Promo</h2>
                <p className="text-xs text-muted-foreground">
                  Klik baris promo untuk melihat produk pemicu dan produk bonus gratis.
                </p>
              </div>
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {formatQuantity(workspace.promos.length)} promo
              </span>
            </div>
            <PromoExpandableTable promos={workspace.promos} />
          </Panel>
        </div>
      </div>
    </>
  );
}
