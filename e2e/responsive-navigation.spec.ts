import { expect, test } from "@playwright/test";
import {
  hasE2ECredentials,
  loginAsAdmin,
  waitForAppHydration,
} from "./helpers/auth";

test.describe("navigasi mobile Admin Gudang", () => {
  test.skip(
    !hasE2ECredentials,
    "Set E2E_ADMIN_EMAIL dan E2E_ADMIN_PASSWORD untuk mengaktifkan pengujian mobile.",
  );

  test("drawer membuka seluruh menu dan dapat berpindah halaman", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.getByRole("button", { name: "Buka menu navigasi" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu operasional" });
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Produk & Batch" }),
    ).toBeVisible();

    await drawer.getByRole("link", { name: "Produk & Batch" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Produk & Batch" }),
    ).toBeVisible();
    await expect(drawer).toBeHidden();
  });

  test("editor order multi-item tetap dapat digunakan tanpa overflow", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/marketplace");
    await waitForAppHydration(page);

    const firstLine = page.locator(".marketplace-line").first();
    await expect(firstLine.getByLabel("Line ID")).toBeVisible();
    await expect(firstLine.getByLabel("Qty")).toBeVisible();
    await expect(
      firstLine.locator('[data-slot="select-trigger"]'),
    ).toBeVisible();

    await page.getByRole("button", { name: "Tambah item" }).click();
    await expect(page.locator(".marketplace-line")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: /Hapus item/ }),
    ).toHaveCount(2);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
