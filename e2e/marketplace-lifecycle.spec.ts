import { expect, test } from "@playwright/test";
import { loginAsAdmin, waitForAppHydration } from "./helpers/auth";
import {
  mutationE2EEnabled,
  mutationE2ESkipReason,
  resetDemoDataset,
} from "./helpers/demo";

test.describe("siklus event marketplace", () => {
  test.skip(
    !mutationE2EEnabled,
    mutationE2ESkipReason,
  );

  test("order dialokasikan, duplikat diabaikan, lalu stok dikirim", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await resetDemoDataset(page);

    await page.goto("/marketplace");
    await waitForAppHydration(page);
    await page
      .getByLabel("ID event marketplace")
      .fill("E2E-SHP-CREATE-001");
    await page
      .getByLabel("ID order marketplace")
      .fill("E2E-SHP-ORDER-001");

    await page.getByRole("button", { name: /Pilih listing Shopee/ }).click();
    await page
      .getByRole("option", { name: /^SER-NIAC-020/ })
      .click();

    await page.getByRole("button", { name: "Tinjau event" }).click();
    await expect(page.getByText("Periksa event sebelum disimpan")).toBeVisible();
    await page.getByRole("button", { name: "Simpan event" }).click();

    const result = page.locator(".command-result");
    await expect(result.getByText("APPLIED", { exact: true })).toBeVisible();
    await expect(result).toContainText("E2E-SHP-ORDER-001");

    const orderTable = page
      .locator("section.panel")
      .filter({
        has: page.getByRole("heading", { name: "Order yang perlu dipantau" }),
      })
      .getByRole("table");
    const orderRow = orderTable
      .getByRole("row")
      .filter({ hasText: "E2E-SHP-ORDER-001" });
    await expect(orderRow).toContainText("Direservasi");

    await page.getByRole("button", { name: "Tinjau event" }).click();
    await page.getByRole("button", { name: "Simpan event" }).click();
    await expect(
      result.getByText("DUPLICATE", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Order diterima.*Tahap order/ })
      .click();
    await page
      .getByRole("option", { name: "Order masuk proses pengiriman" })
      .click();
    await page
      .getByLabel("ID event marketplace")
      .fill("E2E-SHP-SHIP-001");

    await page.getByRole("button", { name: "Tinjau event" }).click();
    await page.getByRole("button", { name: "Simpan event" }).click();
    await expect(result.getByText("APPLIED", { exact: true })).toBeVisible();
    await expect(result).toContainText("SHIPPED");

    await page.goto("/marketplace#event-inbox");
    await waitForAppHydration(page);
    await expect(
      orderTable.getByRole("row").filter({ hasText: "E2E-SHP-ORDER-001" }),
    ).toContainText("Dikirim");

    const eventTable = page
      .locator("section.panel")
      .filter({ has: page.getByRole("heading", { name: "Riwayat event" }) })
      .getByRole("table");
    const eventRows = eventTable
      .getByRole("row")
      .filter({ hasText: "E2E-SHP-CREATE-001" });
    await expect(eventRows).toHaveCount(2);
    await expect(
      eventRows.filter({ hasText: "Duplikat diabaikan" }),
    ).toHaveCount(1);
  });
});
