import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  pagination: new URL("../lib/pagination.ts", import.meta.url),
  component: new URL("../components/pagination.tsx", import.meta.url),
  inventory: new URL("../lib/data/inventory.ts", import.meta.url),
  marketplace: new URL("../lib/data/marketplace.ts", import.meta.url),
  operations: new URL("../lib/data/operations.ts", import.meta.url),
  ledgerPage: new URL("../app/(app)/ledger/page.tsx", import.meta.url),
  productsPage: new URL("../app/(app)/products/page.tsx", import.meta.url),
  marketplacePage: new URL("../app/(app)/marketplace/page.tsx", import.meta.url),
  opnamePage: new URL("../app/(app)/opname/page.tsx", import.meta.url),
  reconciliationPage: new URL(
    "../app/(app)/reconciliation/page.tsx",
    import.meta.url,
  ),
};

const source = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([name, url]) => [name, await readFile(url, "utf8")]),
  ),
);

test("table pagination uses a consistent 25-row server-side contract", () => {
  assert.match(source.pagination, /DEFAULT_PAGE_SIZE = 25/);
  assert.match(source.pagination, /PAGE_SIZE_OPTIONS = \[5, 10, 25, 50\]/);
  assert.match(source.pagination, /parsePageSize/);
  assert.match(source.pagination, /getPageRange/);
  assert.match(source.component, /Navigasi halaman tabel/);
  assert.match(source.component, /Data per halaman/);
  assert.match(source.component, /getVisiblePages/);
  assert.match(source.component, /aria-current="page"/);
  assert.match(source.component, /Buka halaman/);
  assert.match(source.component, /Sebelumnya/);
  assert.match(source.component, /Berikutnya/);

  assert.match(source.inventory, /getInventorySnapshotPage[\s\S]*search_inventory_products/);
  assert.match(source.inventory, /getLedgerEntriesPage[\s\S]*search_stock_movements/);
  assert.match(source.marketplace, /getMarketplaceOrdersPage[\s\S]*search_marketplace_orders/);
  assert.match(source.marketplace, /getMarketplaceInboxPage[\s\S]*search_marketplace_event_attempts/);
  assert.match(source.operations, /getOpnameHistoryPage[\s\S]*\.range\(from, to\)/);
  assert.match(source.operations, /getAnomaliesPage[\s\S]*\.range\(from, to\)/);
});

test("all primary operational tables render the shared pagination navigation", () => {
  for (const page of [
    "ledgerPage",
    "productsPage",
    "marketplacePage",
    "opnamePage",
    "reconciliationPage",
  ]) {
    assert.match(source[page], /<Pagination/);
    assert.match(source[page], /parsePageSize/);
  }

  assert.match(source.marketplacePage, /pageParam="ordersPage"/);
  assert.match(source.marketplacePage, /pageParam="eventsPage"/);
  assert.match(source.marketplacePage, /pageSizeParam="ordersPageSize"/);
  assert.match(source.marketplacePage, /pageSizeParam="eventsPageSize"/);
});
