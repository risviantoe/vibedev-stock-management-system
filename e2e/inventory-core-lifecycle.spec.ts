import { expect, test } from "@playwright/test";
import { loginAsAdmin, waitForAppHydration } from "./helpers/auth";
import {
  mutationE2EEnabled,
  mutationE2ESkipReason,
  resetDemoDataset,
} from "./helpers/demo";
import {
  ariaField,
  fillDateField,
  futureLocalDate,
} from "./helpers/forms";

const cleanserProductId = "61000000-0000-4000-8000-000000000001";
const sunscreenProductId = "61000000-0000-4000-8000-000000000003";

test.describe("siklus stok inti", () => {
  test.skip(!mutationE2EEnabled, mutationE2ESkipReason);

  test("opening balance menghasilkan bukti dan status belum terverifikasi", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await resetDemoDataset(page);

    await page.goto(`/products/${sunscreenProductId}`);
    await waitForAppHydration(page);
    const openingPanel = page.locator("section.panel").filter({
      has: page.getByRole("heading", { name: "Opening balance" }),
    });

    await openingPanel.getByLabel("Kuantitas opening").fill("9");
    await openingPanel.getByLabel("Referensi").fill("E2E-OPENING-SUN-001");
    await openingPanel
      .getByRole("button", { name: "Tinjau saldo awal" })
      .click();

    const preview = openingPanel.locator(".confirmation-preview");
    await expect(preview).toContainText("SUN-DEMO-A");
    await expect(preview).toContainText("+9 unit");
    await expect(preview).toContainText("Belum terverifikasi");

    await openingPanel
      .getByRole("button", { name: "Konfirmasi saldo awal" })
      .click();

    await expect(page).toHaveURL(/\/ledger\/[0-9a-f-]+$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "Opening balance" }),
    ).toBeVisible();
    await expect(page.locator(".receipt-hero")).toContainText("Berhasil");

    const movement = page.locator(".receipt-line").filter({
      hasText: "SUN-DEMO-A",
    });
    await expect(movement).toContainText("E2E-OPENING-SUN-001");
    await expect(movement.locator(".receipt-delta")).toHaveText("+9");

    await page.goto(`/products/${sunscreenProductId}`);
    await waitForAppHydration(page);
    const batchCard = page.locator(".batch-card").filter({
      hasText: "SUN-DEMO-A",
    });
    await expect(batchCard).toContainText("Opening belum verified");
  });

  test("barang masuk dialokasikan FEFO lalu tercatat di ledger", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await resetDemoDataset(page);

    await page.goto("/inbound");
    await waitForAppHydration(page);
    const inboundProductField = ariaField(page, "Produk");
    await inboundProductField.getByRole("button").click();
    await page
      .getByRole("option", { name: /^CLN-GENTLE-100/ })
      .click();
    await page.getByLabel("Referensi maklon").fill("E2E-INBOUND-CLN-001");
    await page.getByLabel("Kode batch").fill("E2E-CLN-EARLY");
    await fillDateField(
      ariaField(page, "Tanggal kedaluwarsa"),
      futureLocalDate(45),
    );
    await page.getByLabel("Kuantitas diterima").fill("7");
    await page.getByRole("button", { name: "Tinjau dampak stok" }).click();

    const inboundPreview = page.locator(".confirmation-preview");
    await expect(inboundPreview).toContainText("E2E-CLN-EARLY");
    await expect(inboundPreview).toContainText("+7");
    await expect(inboundPreview).toContainText(/0\s*→\s*7/);

    await page
      .getByRole("button", { name: "Konfirmasi barang masuk" })
      .click();
    await expect(page).toHaveURL(/\/ledger\/[0-9a-f-]+$/, {
      timeout: 15_000,
    });

    const inboundMovement = page.locator(".receipt-line").filter({
      hasText: "E2E-CLN-EARLY",
    });
    await expect(inboundMovement).toContainText("E2E-INBOUND-CLN-001");
    await expect(inboundMovement.locator(".receipt-delta")).toHaveText("+7");
    await expect(inboundMovement.locator(".balance-proof")).toContainText(
      /0\s*→\s*7/,
    );

    await page.goto("/manual");
    await waitForAppHydration(page);
    const productField = ariaField(page, "Produk");
    await productField.getByRole("button").click();
    await page
      .getByRole("option", { name: /^CLN-GENTLE-100/ })
      .click();
    await page.getByLabel("Kuantitas keluar").fill("5");
    await page.getByLabel(/Referensi/).fill("E2E-OUTBOUND-CLN-001");
    await page
      .getByRole("button", { name: "Tinjau alokasi batch" })
      .click();

    const fefoPreview = page.locator(".fefo-preview");
    await expect(fefoPreview).toContainText("Stok cukup");
    const allocation = fefoPreview.getByRole("row").filter({
      hasText: "E2E-CLN-EARLY",
    });
    await expect(allocation).toContainText("5");
    await expect(allocation).toContainText("7");
    await expect(allocation).toContainText("2");

    await page
      .getByRole("button", { name: "Konfirmasi barang keluar" })
      .click();
    await expect(page).toHaveURL(/\/ledger\/[0-9a-f-]+$/, {
      timeout: 15_000,
    });

    const outboundMovement = page.locator(".receipt-line").filter({
      hasText: "E2E-CLN-EARLY",
    });
    await expect(outboundMovement).toContainText("E2E-OUTBOUND-CLN-001");
    await expect(outboundMovement.locator(".receipt-delta")).toHaveText("-5");
    await expect(outboundMovement.locator(".balance-proof")).toContainText(
      /7\s*→\s*2/,
    );

    await page.goto(`/products/${cleanserProductId}`);
    await waitForAppHydration(page);
    const batchCard = page.locator(".batch-card").filter({
      hasText: "E2E-CLN-EARLY",
    });
    await expect(batchCard).toContainText("2 unit");

    await page.goto("/ledger");
    await waitForAppHydration(page);
    const lifecycleRows = page
      .getByRole("table")
      .getByRole("row")
      .filter({ hasText: "E2E-CLN-EARLY" });
    await expect(lifecycleRows).toHaveCount(2);
    await expect(lifecycleRows.filter({ hasText: "Barang masuk" })).toHaveCount(
      1,
    );
    await expect(
      lifecycleRows.filter({ hasText: "Penjualan offline" }),
    ).toHaveCount(1);
  });
});
