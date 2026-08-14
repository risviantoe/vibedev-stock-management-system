import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [dashboardSource, receiptSource, productFormSource, batchFormSource, stylesSource] =
  await Promise.all([
    readFile(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/ledger/[commandId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/forms/product-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/forms/batch-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

test("transaction receipt communicates confidence without hiding the outcome", () => {
  assert.match(receiptSource, /Transaksi tercatat utuh/);
  assert.match(receiptSource, /Stok tetap konsisten/);
  assert.match(receiptSource, /Stok tidak berubah/);
  assert.match(receiptSource, /aria-labelledby="receipt-outcome-title"/);
  assert.match(receiptSource, /ShieldCheck/);
});

test("quiet operational moments provide useful human feedback", () => {
  assert.match(dashboardSource, /Semua aman untuk saat ini/);
  assert.match(dashboardSource, /PackageOpen/);
  assert.match(productFormSource, /role="status"/);
  assert.match(productFormSource, /siap diberi batch/);
  assert.match(batchFormSource, /siap menerima stok/);
});

test("authored receipt motion respects reduced-motion preferences", () => {
  assert.match(stylesSource, /@keyframes receipt-seal-in/);
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(stylesSource, /\.receipt-seal,/);
});
