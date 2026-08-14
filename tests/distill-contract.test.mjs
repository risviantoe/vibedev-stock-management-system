import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [dashboardSource, integritySource, ledgerSource, receiptSource, shellSource] =
  await Promise.all([
    readFile(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/integrity/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/ledger/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/(app)/ledger/[commandId]/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8"),
  ]);

test("dashboard keeps one primary action and four operational overview cards", () => {
  assert.equal((dashboardSource.match(/primary-button/g) ?? []).length, 1);
  assert.match(dashboardSource, /Catat barang masuk/);
  assert.doesNotMatch(dashboardSource, /metric-grid-three/);
  assert.match(dashboardSource, /SKU aktif/);
  assert.match(dashboardSource, /Kedaluwarsa ≤ 90 hari/);
  assert.match(dashboardSource, /Saldo awal belum diverifikasi/);
});

test("all operational navigation destinations remain directly visible", () => {
  assert.doesNotMatch(shellSource, /secondaryNavigationItems/);
  assert.doesNotMatch(shellSource, /nav-section-disclosure/);
  assert.doesNotMatch(shellSource, /Pengaturan & bukti/);
  assert.match(shellSource, /href: "\/promos"/);
  assert.match(shellSource, /href: "\/integrity"/);
  assert.match(shellSource, /href: "\/notifications"/);
  assert.match(shellSource, /href: "\/ledger"/);
});

test("advanced and demo controls are available without dominating integrity", () => {
  assert.equal((integritySource.match(/<details/g) ?? []).length, 2);
  assert.match(integritySource, /Pemeriksaan perlindungan lanjutan/);
  assert.match(integritySource, /Pemeliharaan data contoh/);
  assert.doesNotMatch(integritySource, /evidence-principles/);
});

test("ledger and receipt avoid repeating immutable-history claims", () => {
  assert.doesNotMatch(ledgerSource, /ledger-principle/);
  assert.doesNotMatch(receiptSource, /receipt-footer-proof/);
  assert.match(receiptSource, /Lihat bukti teknis transaksi/);
});
