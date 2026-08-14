import { expect, type Page } from "@playwright/test";
import { hasE2ECredentials } from "./auth";

const mutationEnabled = process.env.E2E_MUTATION_MODE === "demo";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const localTarget = ["127.0.0.1", "localhost"].includes(
  new URL(baseURL).hostname,
);

export const mutationE2EEnabled =
  hasE2ECredentials && mutationEnabled && localTarget;

export const mutationE2ESkipReason =
  "Pengujian mutasi hanya aktif dengan credential E2E, E2E_MUTATION_MODE=demo, dan target localhost.";

export async function resetDemoDataset(page: Page) {
  const response = await page.request.post("/api/demo/reset", {
    data: { confirmation: "RESET DEMO" },
  });

  expect(
    response.ok(),
    `Reset fixture demo gagal: ${await response.text()}`,
  ).toBeTruthy();
}
