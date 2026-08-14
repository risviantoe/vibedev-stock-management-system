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

test.describe("siklus retur dan kontrol stok", () => {
  test.skip(!mutationE2EEnabled, mutationE2ESkipReason);

  test("retur layak jual masuk ke batch RETURN dan menambah stok", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await resetDemoDataset(page);

    await page.goto("/returns");
    await waitForAppHydration(page);

    const createPanel = page.locator("section.panel").filter({
      has: page.getByRole("heading", { name: "Catat barang yang kembali" }),
    });
    const orderField = ariaField(createPanel, "Order yang sudah dikirim");
    await orderField.getByRole("button").click();
    await page
      .getByRole("option", { name: /^DEMO-TT-ORDER-001/ })
      .click();
    await createPanel
      .getByLabel("External return ID")
      .fill("E2E-RETURN-SELLABLE-001");

    const candidate = createPanel.locator(".return-candidate").filter({
      hasText: "CLN-GENTLE-100",
    });
    await candidate.getByRole("spinbutton").fill("3");
    await createPanel.getByRole("button", { name: "Tinjau retur" }).click();

    const returnPreview = createPanel.locator(".confirmation-preview");
    await expect(returnPreview).toContainText("E2E-RETURN-SELLABLE-001");
    await expect(returnPreview).toContainText("DEMO-TT-ORDER-001");
    await expect(returnPreview).toContainText("CLN-GENTLE-100");
    await expect(returnPreview).toContainText("3 unit");
    await expect(returnPreview).toContainText("belum menambah stok");

    await createPanel
      .getByRole("button", { name: "Konfirmasi retur" })
      .click();

    const returnCard = page.locator(".return-card").filter({
      hasText: "E2E-RETURN-SELLABLE-001",
    });
    await expect(returnCard).toContainText("Menunggu inspeksi", {
      timeout: 15_000,
    });

    const inspectionForm = returnCard.locator(".inspection-form");
    await inspectionForm
      .getByLabel("Batch return")
      .fill("E2E-RETURN-CLN-001");
    await fillDateField(
      ariaField(inspectionForm, "Tanggal kedaluwarsa baru"),
      futureLocalDate(180),
    );
    await inspectionForm
      .getByRole("button", { name: "Tinjau inspeksi" })
      .click();
    await expect(inspectionForm.getByRole("alert")).toContainText(
      "Kode batch return wajib diawali RETURN-.",
    );

    await inspectionForm
      .getByLabel("Batch return")
      .fill("RETURN-E2E-CLN-001");
    await inspectionForm
      .getByRole("button", { name: "Tinjau inspeksi" })
      .click();

    const inspectionPreview = inspectionForm.locator(
      ".confirmation-preview",
    );
    await expect(inspectionPreview).toContainText("Layak jual");
    await expect(inspectionPreview).toContainText("+3");
    await expect(inspectionPreview).toContainText("RETURN-E2E-CLN-001");

    await inspectionForm
      .getByRole("button", { name: "Konfirmasi inspeksi" })
      .click();
    await expect(returnCard).toContainText(
      "Masuk batch RETURN-E2E-CLN-001",
      { timeout: 15_000 },
    );
    await expect(returnCard).toContainText("Selesai");

    await page.goto(`/products/${cleanserProductId}`);
    await waitForAppHydration(page);
    const batchCard = page.locator(".batch-card").filter({
      hasText: "RETURN-E2E-CLN-001",
    });
    await expect(batchCard).toContainText("3 unit");

    await page.goto("/ledger");
    await waitForAppHydration(page);
    const returnMovement = page
      .getByRole("table")
      .getByRole("row")
      .filter({ hasText: "RETURN-E2E-CLN-001" });
    await expect(returnMovement).toHaveCount(1);
    await expect(returnMovement).toContainText("Retur layak jual");
    await expect(returnMovement).toContainText("+3");
  });

  test("opname membuat adjustment sekali lalu rekonsiliasi tetap bersih", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await resetDemoDataset(page);

    await page.goto("/opname");
    await waitForAppHydration(page);
    await page.getByRole("button", { name: "Tinjau sesi" }).click();
    await expect(page.locator(".confirmation-preview")).toContainText(
      "Mulai sesi opname",
    );
    const startResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/commands/opname/start") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Konfirmasi mulai" }).click();
    expect((await startResponse).ok()).toBeTruthy();
    await page.reload();
    await waitForAppHydration(page);
    await expect(
      page.getByRole("heading", { name: "Hitung fisik per batch" }),
    ).toBeVisible({ timeout: 15_000 });

    const targetRow = page.getByRole("row").filter({
      hasText: "CLN-DEMO-FEFO-B",
    });
    const systemQty = Number(
      (await targetRow.getByRole("cell").nth(3).textContent())?.trim(),
    );
    expect(Number.isSafeInteger(systemQty) && systemQty > 0).toBeTruthy();
    await targetRow
      .getByLabel("Hitung fisik CLN-DEMO-FEFO-B")
      .fill(String(systemQty - 1));

    await page
      .getByRole("button", { name: "Tinjau & simpan draft" })
      .click();
    const draftPreview = page.locator(".confirmation-preview");
    await expect(draftPreview).toContainText("Konfirmasi draft hitung");
    await expect(draftPreview).toContainText("Variance");
    await page.getByRole("button", { name: "Konfirmasi draft" }).click();
    await expect(targetRow).toContainText("Tersimpan", { timeout: 15_000 });

    await page
      .getByRole("button", { name: "Tinjau penyelesaian" })
      .click();
    const finalizePreview = page.locator(".confirmation-preview");
    await expect(finalizePreview).toContainText("Konfirmasi finalisasi");
    await expect(finalizePreview).toContainText("Saat finalisasi");
    await page
      .getByRole("button", { name: "Konfirmasi penyelesaian" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Mulai opname baru" }),
    ).toBeVisible({ timeout: 15_000 });
    const finalizedRow = page
      .locator("section.panel")
      .filter({
        has: page.getByRole("heading", { name: "Sesi yang sudah selesai" }),
      })
      .locator("tbody")
      .getByRole("row")
      .filter({ hasText: "Selesai" });
    await expect(finalizedRow).toHaveCount(2);

    await page.goto("/ledger");
    await waitForAppHydration(page);
    const adjustment = page
      .getByRole("table")
      .getByRole("row")
      .filter({ hasText: "CLN-DEMO-FEFO-B" })
      .filter({ hasText: "Penyesuaian opname" });
    await expect(
      adjustment.getByRole("cell", { name: "-1", exact: true }),
    ).toHaveCount(1);

    await page.goto("/reconciliation");
    await waitForAppHydration(page);
    await page
      .getByRole("button", { name: "Tinjau pemeriksaan" })
      .click();
    await expect(page.locator(".confirmation-preview")).toContainText(
      "Rekonsiliasi stok",
    );
    await page
      .getByRole("button", { name: "Konfirmasi pemeriksaan" })
      .click();
    await expect(page.locator(".form-success")).toContainText(
      "0 anomaly masih terbuka",
      { timeout: 15_000 },
    );
    await expect(
      page.getByText("Tidak ada masalah", { exact: true }),
    ).toBeVisible();
  });
});
