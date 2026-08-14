import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  migration: new URL(
    "../supabase/migrations/202608120001_operational_retrieval.sql",
    import.meta.url,
  ),
  retrieval: new URL("../lib/retrieval.ts", import.meta.url),
  toolbar: new URL(
    "../components/operational-table-toolbar.tsx",
    import.meta.url,
  ),
  inventory: new URL("../lib/data/inventory.ts", import.meta.url),
  marketplace: new URL("../lib/data/marketplace.ts", import.meta.url),
  productsPage: new URL("../app/(app)/products/page.tsx", import.meta.url),
  ledgerPage: new URL("../app/(app)/ledger/page.tsx", import.meta.url),
  marketplacePage: new URL(
    "../app/(app)/marketplace/page.tsx",
    import.meta.url,
  ),
  styles: new URL("../app/globals.css", import.meta.url),
};

const source = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([name, url]) => [
      name,
      await readFile(url, "utf8"),
    ]),
  ),
);

test("retrieval stays server-side, paginated, and admin-scoped", () => {
  for (const routine of [
    "search_inventory_products",
    "search_stock_movements",
    "search_marketplace_orders",
    "search_marketplace_event_attempts",
  ]) {
    assert.match(source.migration, new RegExp(`function public\\.${routine}`, "i"));
    assert.match(source.migration, new RegExp(`grant execute on function public\\.${routine}[\\s\\S]*to authenticated`, "i"));
  }

  assert.equal((source.migration.match(/security invoker/gi) ?? []).length, 4);
  assert.match(source.migration, /count\(\*\) over \(\)/i);
  assert.match(source.migration, /greatest\(p_page, 1\)/i);
  assert.match(source.migration, /least\(greatest\(p_page_size, 1\), 100\)/i);
  assert.doesNotMatch(source.migration, /security definer/i);
});

test("URL parsers constrain retrieval values and keep intentional defaults", () => {
  assert.match(source.retrieval, /parseProductRetrieval/);
  assert.match(source.retrieval, /parseLedgerRetrieval/);
  assert.match(source.retrieval, /parseMarketplaceOrderRetrieval/);
  assert.match(source.retrieval, /parseMarketplaceEventRetrieval/);
  assert.match(source.retrieval, /slice\(0, 160\)/);
  assert.match(source.retrieval, /status:[\s\S]*"ACTIVE"/);
  assert.match(source.retrieval, /sort:[\s\S]*"SKU_ASC"/);
  assert.match(source.retrieval, /sort:[\s\S]*"OCCURRED_DESC"/);
});

test("data loaders call the retrieval RPC before enriching rows", () => {
  assert.match(source.inventory, /rpc\("search_inventory_products"/);
  assert.match(source.inventory, /rpc\("search_stock_movements"/);
  assert.match(source.inventory, /productIds[\s\S]*\.in\("id", productIds\)/);
  assert.match(source.inventory, /movementIds[\s\S]*\.in\("id", movementIds\)/);
  assert.match(source.marketplace, /rpc\("search_marketplace_orders"/);
  assert.match(source.marketplace, /rpc\("search_marketplace_event_attempts"/);
});

test("shared toolbar supports URL state, keyboard search, chips, and mobile filters", () => {
  assert.match(source.toolbar, /useSearchParams/);
  assert.match(source.toolbar, /aria-keyshortcuts="\/"/);
  assert.match(source.toolbar, /primaryShortcutTarget[\s\S]*searchInputRef\.current !== primaryShortcutTarget/);
  assert.match(source.toolbar, /Filter dan urutkan/);
  assert.match(source.toolbar, /retrieval-search-submit[\s\S]*Cari/);
  assert.match(source.toolbar, /retrieval-filter-actions[\s\S]*Terapkan filter dan urutan/);
  assert.match(source.toolbar, /Atur ulang filter dan urutan/);
  assert.match(source.toolbar, /Mencari…/);
  assert.match(source.toolbar, /Menerapkan…/);
  assert.match(source.toolbar, /retrieval-chip/);
  assert.match(source.toolbar, /nextParams\.delete\(pageParam\)/);
  assert.match(source.toolbar, /router\.push\(destination\)/);
  assert.match(
    source.toolbar,
    /activeFilters = fields\.filter\([\s\S]*appliedValues\[field\.name\]/,
  );
  assert.doesNotMatch(source.toolbar, /resultCount|resultLabel/);
  assert.doesNotMatch(source.productsPage, /<OperationalTableToolbar\s+[\s\S]{0,160}key=/);
  assert.match(source.productsPage, /aria-labelledby="products-table-heading"/);
  assert.match(source.ledgerPage, /aria-labelledby="ledger-table-heading"/);
  assert.match(source.marketplacePage, /aria-labelledby="marketplace-orders-heading"/);
  assert.match(source.marketplacePage, /aria-labelledby="marketplace-events-heading"/);
  assert.match(
    source.toolbar,
    /const nextValues = \{ \.\.\.appliedValues, \[name\]: field\.defaultValue \}/,
  );
  assert.match(source.styles, /\.retrieval-filter-toggle/);
  assert.match(source.styles, /\.retrieval-fields\.is-open\s*\{\s*display: grid/);
  assert.match(source.styles, /\.retrieval-applied-filters/);
  assert.match(source.styles, /\.retrieval-search-submit\s*\{[\s\S]*min-height: 2\.75rem/);
  assert.match(source.styles, /\.retrieval-date-field \.aria-date-button\s*\{[\s\S]*min-height: 2\.75rem/);
  assert.match(
    source.styles,
    /@media \(max-width: 760px\)[\s\S]*\.retrieval-search-control input\s*\{\s*font-size: 1rem/,
  );
  assert.match(source.styles, /@media \(max-width: 760px\)[\s\S]*\.retrieval-fields\.is-open/);
  assert.match(source.styles, /min-height: 2\.75rem/);
});

test("primary operational tables expose page-specific retrieval controls", () => {
  assert.match(source.productsPage, /searchParam="q"/);
  assert.match(source.productsPage, /Status produk/);
  assert.match(source.productsPage, /Kedaluwarsa terdekat/);
  assert.match(source.ledgerPage, /Cari riwayat stok/);
  assert.match(source.ledgerPage, /Dari tanggal/);
  assert.match(source.ledgerPage, /Status catatan/);
  assert.match(source.marketplacePage, /searchParam="orderQ"/);
  assert.match(source.marketplacePage, /searchParam="eventQ"/);
  assert.match(source.marketplacePage, /orderFilterQuery/);
  assert.match(source.marketplacePage, /eventFilterQuery/);
});
