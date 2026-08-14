import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, waitForAppHydration } from "./helpers/auth";
import {
  mutationE2EEnabled,
  mutationE2ESkipReason,
  resetDemoDataset,
} from "./helpers/demo";
import { ariaField } from "./helpers/forms";

const cleanserProductId = "61000000-0000-4000-8000-000000000001";
const serumProductId = "61000000-0000-4000-8000-000000000002";

async function readProductMetrics(page: Page, productId: string) {
  await page.goto(`/products/${productId}`);
  await waitForAppHydration(page);

  const readMetric = async (label: string) => {
    const card = page.locator('[data-slot="metric-card"]').filter({
      has: page.getByText(label, { exact: true }),
    });
    return Number(
      (await card.locator('[data-slot="card-title"]').textContent())?.trim(),
    );
  };

  return {
    onHand: await readMetric("On hand"),
    reserved: await readMetric("Reserved"),
    available: await readMetric("Available"),
  };
}

async function selectOrderStage(page: Page, option: string) {
  await ariaField(page, "Tahap order").getByRole("button").click();
  await page.getByRole("option", { name: option }).click();
}

test.describe("jalur penolakan transaksi stok", () => {
  test.skip(!mutationE2EEnabled, mutationE2ESkipReason);

  test("pembatalan memulihkan reservation dan shipment berikutnya ditolak", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await resetDemoDataset(page);

    const initial = await readProductMetrics(page, serumProductId);
    expect(initial.reserved).toBeGreaterThanOrEqual(0);

    await page.goto("/marketplace");
    await waitForAppHydration(page);
    await page
      .getByLabel("ID event marketplace")
      .fill("E2E-CANCEL-CREATE-001");
    await page
      .getByLabel("ID order marketplace")
      .fill("E2E-CANCEL-ORDER-001");
    await page.getByLabel("Line ID").fill("LINE-CANCEL-1");
    await page.getByRole("button", { name: /Pilih listing Shopee/ }).click();
    await page
      .getByRole("option", { name: /^SER-NIAC-020/ })
      .click();
    await page.getByLabel("Qty").fill("2");
    await page.getByRole("button", { name: "Tinjau event" }).click();
    await page.getByRole("button", { name: "Simpan event" }).click();

    const result = page.locator(".command-result");
    await expect(result.getByText("APPLIED", { exact: true })).toBeVisible();
    await expect(result).toContainText("RESERVED");

    const reserved = await readProductMetrics(page, serumProductId);
    expect(reserved.onHand).toBe(initial.onHand);
    expect(reserved.reserved).toBe(initial.reserved + 2);
    expect(reserved.available).toBe(initial.available - 2);

    await page.goto("/marketplace");
    await waitForAppHydration(page);
    await selectOrderStage(page, "Order dibatalkan");
    await page
      .getByLabel("ID event marketplace")
      .fill("E2E-CANCEL-APPLY-001");
    await page
      .getByLabel("ID order marketplace")
      .fill("E2E-CANCEL-ORDER-001");
    await page.getByLabel("Line ID").fill("LINE-CANCEL-1");
    await page.getByLabel("Qty").fill("2");
    await page.getByRole("button", { name: "Tinjau event" }).click();
    await page.getByRole("button", { name: "Simpan event" }).click();
    await expect(result.getByText("APPLIED", { exact: true })).toBeVisible();
    await expect(result).toContainText("CANCELLED");

    const restored = await readProductMetrics(page, serumProductId);
    expect(restored).toEqual(initial);

    await page.goto("/marketplace");
    await waitForAppHydration(page);
    await selectOrderStage(page, "Order masuk proses pengiriman");
    await page
      .getByLabel("ID event marketplace")
      .fill("E2E-CANCEL-SHIP-001");
    await page
      .getByLabel("ID order marketplace")
      .fill("E2E-CANCEL-ORDER-001");
    await page.getByRole("button", { name: "Tinjau event" }).click();
    await page.getByRole("button", { name: "Simpan event" }).click();

    await expect(result.getByText("REJECTED", { exact: true })).toBeVisible();
    await expect(result).toContainText("OUT_OF_ORDER_SHIPMENT_EVENT");

    const orderTable = page
      .locator("section.panel")
      .filter({
        has: page.getByRole("heading", { name: "Order yang perlu dipantau" }),
      })
      .getByRole("table");
    await expect(
      orderTable
        .getByRole("row")
        .filter({ hasText: "E2E-CANCEL-ORDER-001" }),
    ).toContainText("Dibatalkan");
    expect(await readProductMetrics(page, serumProductId)).toEqual(initial);
  });

  test("stok tidak cukup ditolak tanpa mengubah saldo atau ledger", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await resetDemoDataset(page);

    const initial = await readProductMetrics(page, cleanserProductId);
    const impossibleQty = initial.available + 1000;

    await page.goto("/manual");
    await waitForAppHydration(page);
    const productField = ariaField(page, "Produk");
    await productField.getByRole("button").click();
    await page
      .getByRole("option", { name: /^CLN-GENTLE-100/ })
      .click();
    await page.getByLabel("Kuantitas keluar").fill(String(impossibleQty));
    await page
      .getByRole("button", { name: "Tinjau alokasi batch" })
      .click();

    const preview = page.locator(".fefo-preview");
    await expect(preview).toContainText("Stok tidak cukup");
    await expect(preview).toContainText(
      `Diminta ${impossibleQty.toLocaleString("id-ID")}`,
    );
    await expect(
      page.getByRole("button", { name: "Konfirmasi barang keluar" }),
    ).toBeDisabled();

    const response = await page.request.post(
      "/api/commands/manual-outbound",
      {
        data: {
          idempotencyKey: "e2e:manual:insufficient:001",
          productId: cleanserProductId,
          qty: impossibleQty,
          reason: "OFFLINE_SALE",
          channel: "OFFLINE",
          reference: "E2E-INSUFFICIENT-001",
        },
      },
    );
    const payload = (await response.json()) as {
      data: {
        outcome: string;
        movements: unknown[];
        error: { code: string; message: string } | null;
      };
    };
    expect(response.ok(), JSON.stringify(payload)).toBeTruthy();
    expect(payload.data.outcome).toBe("REJECTED");
    expect(payload.data.error?.message).toBe("INSUFFICIENT_STOCK");
    expect(payload.data.movements).toHaveLength(0);

    expect(await readProductMetrics(page, cleanserProductId)).toEqual(initial);
    await page.goto("/ledger");
    await waitForAppHydration(page);
    await expect(page.getByRole("table")).not.toContainText(
      "E2E-INSUFFICIENT-001",
    );
  });
});
