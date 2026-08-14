import { expect, test } from "@playwright/test";

test("halaman login siap digunakan", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Masuk ke StokLedger" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Masuk sebagai Admin" }),
  ).toBeEnabled();
});

test("halaman operasional mengarahkan pengguna anonim ke login", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?/);
  const currentUrl = new URL(page.url());
  expect(currentUrl.searchParams.get("next")).toBe("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Masuk ke StokLedger" }),
  ).toBeVisible();
});
