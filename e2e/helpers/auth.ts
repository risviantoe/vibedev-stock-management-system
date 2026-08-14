import { expect, type Page } from "@playwright/test";

const email =
  process.env.E2E_ADMIN_EMAIL?.trim() ??
  process.env.DEMO_LOGIN_EMAIL?.trim() ??
  "";
const password =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.DEMO_LOGIN_PASSWORD ?? "";

export const hasE2ECredentials = Boolean(email && password);

export async function waitForAppHydration(page: Page) {
  await page.locator('main[data-app-hydrated="true"]').waitFor();
}

export async function loginAsAdmin(page: Page) {
  if (!hasE2ECredentials) {
    throw new Error(
      "Set E2E_ADMIN_EMAIL dan E2E_ADMIN_PASSWORD sebelum menjalankan E2E terautentikasi.",
    );
  }

  await page.goto("/login?next=/dashboard");
  await page.locator('form.login-form[data-hydrated="true"]').waitFor();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Masuk sebagai Admin" }).click();

  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some((cookie) => cookie.name.endsWith("-auth-token"));
    }, { timeout: 15_000 })
    .toBe(true);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(750);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      break;
    } catch (error) {
      const aborted =
        error instanceof Error && error.message.includes("ERR_ABORTED");
      if (!aborted || attempt === 1) throw error;
      await page.waitForTimeout(500);
    }
  }

  await waitForAppHydration(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tugas Hari Ini" }),
  ).toBeVisible();
}
