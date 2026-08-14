import { expect, test } from "@playwright/test";
import {
  ariaField,
  fillDateField,
  futureLocalDate,
} from "./helpers/forms";
import {
  hasE2ECredentials,
  loginAsAdmin,
  waitForAppHydration,
} from "./helpers/auth";

test.describe("smoke test Admin Gudang", () => {
  test.skip(
    !hasE2ECredentials,
    "Set E2E_ADMIN_EMAIL dan E2E_ADMIN_PASSWORD untuk mengaktifkan smoke test terautentikasi.",
  );

  test("halaman operasional utama dapat dibuka", async ({ page }) => {
    test.slow();
    await loginAsAdmin(page);

    const routes = [
      ["/products", "Produk & Batch"],
      ["/inbound", "Barang Masuk"],
      ["/manual", "Barang Keluar"],
      ["/marketplace", "Order Marketplace"],
      ["/promos", "Bundle & Promo"],
      ["/returns", "Retur & Inspeksi"],
      ["/opname", "Stok Opname"],
      ["/reconciliation", "Rekonsiliasi"],
      ["/integrity", "Pemeriksaan Stok"],
      ["/notifications", "Notifikasi"],
      ["/ledger", "Riwayat Stok"],
    ] as const;

    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      await expect(page.locator("main")).not.toContainText(
        "Application error",
      );
    }
  });

  test("jumlah data per halaman dapat dipilih dan dinavigasi", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await page.goto("/products");
    await waitForAppHydration(page);

    const pagination = page.getByRole("navigation", {
      name: "Navigasi halaman tabel",
    });
    await expect(pagination).toBeVisible();

    const pageSizeField = ariaField(page, "Data per halaman");
    await pageSizeField.getByRole("button").click();
    await page.getByRole("option", { exact: true, name: "5" }).click();

    await expect(page).toHaveURL(/\/products\?pageSize=5/);
    await expect(page.getByText(/Menampilkan 1.*5 dari .* data/)).toBeVisible();
    await expect(page.locator('[data-slot="table-body"] [data-slot="table-row"]')).toHaveCount(5);

    await pagination.getByRole("link", { name: "Buka halaman 2" }).click();
    await expect(page).toHaveURL(/pageSize=5.*page=2|page=2.*pageSize=5/);
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("2");
    const secondPageRows = await page.locator('[data-slot="table-body"] [data-slot="table-row"]').count();
    expect(secondPageRows).toBeGreaterThan(0);
    expect(secondPageRows).toBeLessThanOrEqual(5);

    await pagination.getByRole("link", { name: "Sebelumnya" }).click();
    await expect(page).toHaveURL(/\/products\?pageSize=5$/);
    await expect(pagination.locator('[aria-current="page"]')).toHaveText("1");
  });

  test("kontrol form interaktif tetap rapi dan dapat digunakan", async ({
    page,
  }) => {
    test.slow();
    await loginAsAdmin(page);
    await page.goto("/inbound");
    await waitForAppHydration(page);

    const dateField = ariaField(page, "Tanggal kedaluwarsa");
    const [batchInputBox, expiryControlBox] = await Promise.all([
      page.getByLabel("Kode batch").boundingBox(),
      dateField.getByRole("group").boundingBox(),
    ]);
    expect(batchInputBox).not.toBeNull();
    expect(expiryControlBox).not.toBeNull();
    expect(Math.abs(batchInputBox!.y - expiryControlBox!.y)).toBeLessThan(2);

    const selectedDate = futureLocalDate(14);
    await fillDateField(dateField, selectedDate);

    const calendarButton = dateField.getByRole("button", {
      name: "Buka kalender",
    });
    await calendarButton.click();

    const calendar = page.locator('[data-slot="calendar"]');
    await expect(calendar).toBeVisible();

    const firstWeekCells = calendar
      .getByRole("row")
      .nth(1)
      .getByRole("gridcell");
    await expect(firstWeekCells).toHaveCount(7);

    const boxes = await firstWeekCells.evaluateAll((cells) =>
      cells.map((cell) => {
        const { x, y } = cell.getBoundingClientRect();
        return { x, y };
      }),
    );

    expect(
      Math.max(...boxes.map(({ y }) => y)) -
        Math.min(...boxes.map(({ y }) => y)),
    ).toBeLessThan(2);
    expect(boxes.at(-1)!.x - boxes[0].x).toBeGreaterThan(100);

    const selectedCell = calendar.locator(
      '[data-slot="calendar-cell"][data-selected]',
    );
    await expect(selectedCell).toHaveText(
      String(Number(selectedDate.slice(-2))),
    );
    await expect(selectedCell).toHaveCSS("color", "rgb(255, 255, 255)");

    const buttonBox = await calendarButton.boundingBox();
    const popoverBox = await page
      .locator('[data-slot="calendar-popover"]')
      .boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(popoverBox).not.toBeNull();
    expect(
      Math.abs(
        buttonBox!.x + buttonBox!.width -
          (popoverBox!.x + popoverBox!.width),
      ),
    ).toBeLessThan(16);

    await page.keyboard.press("Escape");
    await page.goto("/marketplace");
    await waitForAppHydration(page);

    await expect(
      ariaField(page, "Channel")
        .first()
        .locator('[data-slot="select-value"]'),
    ).toHaveText("Shopee");

    const marketplaceLine = page.locator(".marketplace-line").first();
    const lineControlBoxes = await Promise.all([
      marketplaceLine.getByLabel("Line ID").boundingBox(),
      marketplaceLine
        .locator('.line-listing-field [data-slot="select-trigger"]')
        .boundingBox(),
      marketplaceLine.locator(".qty-field input").boundingBox(),
    ]);
    expect(lineControlBoxes.every(Boolean)).toBe(true);
    const controlTopPositions = lineControlBoxes.map((box) => box!.y);
    expect(
      Math.max(...controlTopPositions) - Math.min(...controlTopPositions),
    ).toBeLessThan(2);

    const dateTimeField = ariaField(page, "Waktu kejadian (opsional)");
    await dateTimeField.getByRole("button", { name: "Buka kalender" }).click();

    const timePicker = page.locator('[data-slot="calendar-time-picker"]');
    await expect(timePicker).toBeVisible();
    await expect(ariaField(timePicker, "Jam")).toBeVisible();
    await expect(ariaField(timePicker, "Menit")).toBeVisible();

    await page
      .locator('[data-slot="calendar-cell"][data-today]')
      .click();

    const hourSelect = ariaField(timePicker, "Jam");
    await hourSelect.getByRole("button").click();
    await page.getByRole("option", { exact: true, name: "13" }).click();

    const minuteSelect = ariaField(timePicker, "Menit");
    await minuteSelect.getByRole("button").click();
    await page.getByRole("option", { exact: true, name: "45" }).click();
    await expect(dateTimeField.locator('[data-slot="date-input"]')).toContainText(
      /13:45/,
    );

    await page.keyboard.press("Escape");
    await page.goto("/promos");
    await waitForAppHydration(page);

    const [promoNameBox, promoChannelBox] = await Promise.all([
      page.getByLabel("Nama promo").boundingBox(),
      ariaField(page, "Channel")
        .locator('[data-slot="select-trigger"]')
        .boundingBox(),
    ]);
    expect(promoNameBox).not.toBeNull();
    expect(promoChannelBox).not.toBeNull();
    expect(Math.abs(promoNameBox!.width - promoChannelBox!.width)).toBeLessThan(
      2,
    );

    const triggerProductField = ariaField(page, "Produk pemicu");
    const triggerButton = triggerProductField.locator(
      '[data-slot="select-trigger"]',
    );
    const triggerValue = triggerProductField.locator(
      '[data-slot="select-value"]',
    );
    const [triggerButtonBox, triggerValueBox] = await Promise.all([
      triggerButton.boundingBox(),
      triggerValue.boundingBox(),
    ]);
    expect(triggerButtonBox).not.toBeNull();
    expect(triggerValueBox).not.toBeNull();
    expect(triggerValueBox!.x + triggerValueBox!.width).toBeLessThan(
      triggerButtonBox!.x + triggerButtonBox!.width - 24,
    );
    await expect(triggerValue).toHaveCSS("text-overflow", "ellipsis");

    const recipeLine = page.locator(".recipe-line").first();
    const [recipeProductBox, recipeQtyBox] = await Promise.all([
      recipeLine
        .locator('.line-product-field [data-slot="select-trigger"]')
        .boundingBox(),
      recipeLine.locator(".qty-field").boundingBox(),
    ]);
    expect(recipeProductBox).not.toBeNull();
    expect(recipeQtyBox).not.toBeNull();
    expect(recipeProductBox!.x + recipeProductBox!.width).toBeLessThanOrEqual(
      recipeQtyBox!.x,
    );

    await triggerButton.click();
    const productSearch = page.getByRole("searchbox", {
      name: "Cari SKU atau nama produk",
    });
    await expect(productSearch).toBeVisible();
    const [searchPopoverBox, searchTriggerBox] = await Promise.all([
      page.locator('[data-slot="select-content"]').boundingBox(),
      triggerButton.boundingBox(),
    ]);
    expect(searchPopoverBox).not.toBeNull();
    expect(searchTriggerBox).not.toBeNull();
    expect(searchPopoverBox!.width).toBeGreaterThan(searchTriggerBox!.width);
    await productSearch.fill("SER-NIAC-020");
    await expect(
      page.getByRole("option", { name: /SER-NIAC-020/ }),
    ).toHaveCount(1);

    await productSearch.fill("SKU-TIDAK-TERDAFTAR");
    await expect(
      page.getByRole("option", { name: "Tidak ada pilihan ditemukan" }),
    ).toBeVisible();
  });

  test("dialog koreksi mengelola fokus dan dapat ditutup dengan keyboard", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/ledger");
    await waitForAppHydration(page);

    const correctionTrigger = page.getByRole("button", { name: "Koreksi" }).first();
    await correctionTrigger.click();

    const dialog = page.getByRole("dialog", { name: /Koreksi pergerakan/ });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel("Alasan koreksi")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(correctionTrigger).toBeFocused();
  });

  test("reset demo memakai konfirmasi berisiko yang terkontrol", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/integrity");
    await waitForAppHydration(page);

    await page.getByText("Pemeliharaan data contoh").click();
    const resetTrigger = page.getByRole("button", {
      name: "Atur ulang data contoh",
    });
    await resetTrigger.click();

    const alertDialog = page.getByRole("alertdialog", {
      name: "Ganti seluruh data operasional contoh?",
    });
    await expect(alertDialog).toBeVisible();
    const confirmation = page.getByLabel(/Ketik RESET DEMO/);
    const confirmButton = page.getByRole("button", {
      name: "Konfirmasi pengaturan ulang",
    });
    await expect(confirmButton).toBeDisabled();

    await confirmation.fill("RESET DEMO");
    await expect(confirmButton).toBeEnabled();
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(alertDialog).toBeHidden();
    await expect(resetTrigger).toBeFocused();
  });
});
