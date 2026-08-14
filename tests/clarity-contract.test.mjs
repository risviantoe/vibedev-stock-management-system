import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  integrityPageSource,
  reconciliationPageSource,
  receiptPageSource,
  correctionSource,
  inventoryDomainSource,
  retrievalToolbarSource,
  marketplaceEventSource,
  returnCreateSource,
  opnameWorkspaceSource,
  listingFormSource,
] = await Promise.all([
  readFile(new URL("../app/(app)/integrity/page.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../app/(app)/reconciliation/page.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../app/(app)/ledger/[commandId]/page.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../components/forms/correction-button.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../lib/domain/inventory.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/operational-table-toolbar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/(app)/marketplace/events/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/forms/return-create-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/forms/opname-workspace-form.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/forms/marketplace-listing-form.tsx", import.meta.url), "utf8"),
]);

test("admin-facing integrity and reconciliation use operator language", () => {
  assert.match(integrityPageSource, /Pemeriksaan konsistensi data/);
  assert.match(integrityPageSource, /Tindak lanjuti melalui Rekonsiliasi/);
  assert.doesNotMatch(integrityPageSource, />\{report\.overall_status\}</);
  assert.doesNotMatch(integrityPageSource, />\{check\.status\}</);

  assert.match(reconciliationPageSource, /Masalah dan tindakan/);
  assert.match(reconciliationPageSource, /anomalyOperatorCopy/);
  assert.doesNotMatch(reconciliationPageSource, />\{anomaly\.severity\}</);
  assert.doesNotMatch(reconciliationPageSource, />\{anomaly\.status\}</);
  assert.doesNotMatch(reconciliationPageSource, /JSON\.stringify\(anomaly\.evidence\)/);
});

test("retrieval controls name search, filtering, and sorting outcomes", () => {
  assert.match(retrievalToolbarSource, /Filter dan urutkan/);
  assert.match(retrievalToolbarSource, /Terapkan filter dan urutan/);
  assert.match(retrievalToolbarSource, /Mencari…/);
  assert.match(retrievalToolbarSource, /Menerapkan…/);
});

test("high-stakes operational flows avoid backend and mixed-language jargon", () => {
  assert.match(marketplaceEventSource, /Aktivitas marketplace ditolak/);
  assert.match(marketplaceEventSource, /Lihat detail teknis penolakan/);
  assert.doesNotMatch(marketplaceEventSource, /<h2>\{receipt\.error\.code\}<\/h2>/);

  assert.match(returnCreateSource, /ID retur marketplace/);
  assert.doesNotMatch(returnCreateSource, /External return ID|Partial return|quantity yang/);
  assert.match(opnameWorkspaceSource, /Saldo sistem/);
  assert.match(opnameWorkspaceSource, /Perubahan riwayat stok/);
  assert.doesNotMatch(opnameWorkspaceSource, />Expiry<|>System<|>Variance</);
  assert.match(listingFormSource, /SKU marketplace/);
  assert.match(listingFormSource, /Ubah hubungan produk/);
  assert.doesNotMatch(listingFormSource, /Edit mapping|Listing SKU|diekspansi/);
});

test("technical identifiers are progressive disclosure, not primary content", () => {
  assert.match(integrityPageSource, /TechnicalDetails/);
  assert.match(reconciliationPageSource, /TechnicalDetails/);
  assert.match(receiptPageSource, /Lihat bukti teknis transaksi/);
  assert.doesNotMatch(receiptPageSource, /description=\{`ID transaksi/);
  assert.doesNotMatch(receiptPageSource, /<span>\{receipt\.error\.code\}<\/span>/);
});

test("stock transaction and correction labels avoid internal command jargon", () => {
  assert.match(inventoryDomainSource, /FINALIZE_OPNAME: "Penyelesaian stok opname"/);
  assert.match(inventoryDomainSource, /REBUILD_STOCK_BALANCES: "Penghitungan ulang saldo stok"/);
  assert.match(inventoryDomainSource, /return labels\[commandType\] \?\? "Transaksi stok"/);

  assert.doesNotMatch(correctionSource, /Append-only correction/);
  assert.doesNotMatch(correctionSource, /Movement asal/);
  assert.doesNotMatch(correctionSource, />Reason</);
  assert.match(correctionSource, /Catatan koreksi yang akan dibuat/);
});
