import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [productSource, explanationSource, marketplaceSource, orderSource, inventorySource, marketplaceDomainSource, stylesSource] =
  await Promise.all([
    readFile(new URL("../app/(app)/products/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/products/[id]/explain/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/marketplace/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/marketplace/orders/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/domain/inventory.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/domain/marketplace.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

test("product stock surfaces use consistent warehouse terminology", () => {
  assert.match(productSource, /<span>Stok fisik<\/span>/);
  assert.match(productSource, /<span>Dialokasikan<\/span>/);
  assert.match(productSource, /<span>Tersedia<\/span>/);
  assert.match(productSource, /<h2>Saldo awal<\/h2>/);
  assert.doesNotMatch(productSource, /<span>On hand<\/span>|<span>Reserved<\/span>|<span>Available<\/span>/);
});

test("batch and balance evidence translate operational labels consistently", () => {
  assert.match(inventorySource, /export function batchSourceLabel/);
  assert.match(explanationSource, /batchSourceLabel\(batch\.source_type\)/);
  assert.match(explanationSource, /channelLabel\(movement\.channel\)/);
  assert.match(explanationSource, /Sebelum → Sesudah/);
  assert.match(explanationSource, /Perubahan/);
  assert.doesNotMatch(explanationSource, /<span>On hand<\/span>|<span>Reserved<\/span>|<span>Available<\/span>/);
});

test("marketplace tables and shared interaction states are production-ready", () => {
  assert.match(marketplaceSource, /Unit dipesan/);
  assert.match(marketplaceSource, /Dialokasikan/);
  assert.match(marketplaceSource, /Dikirim/);
  assert.match(marketplaceDomainSource, /export function listingTypeLabel/);
  assert.match(orderSource, /listingTypeLabel\(item\.listing_type\)/);
  assert.match(orderSource, /Dipesan/);
  assert.match(orderSource, /Dibatalkan/);
  assert.match(stylesSource, /\.data-table tbody tr:focus-within/);
  assert.match(stylesSource, /\.secondary-button:disabled/);
});
