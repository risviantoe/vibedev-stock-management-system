import { expect, type Locator, type Page } from "@playwright/test";

export function futureLocalDate(daysFromToday: number): string {
  const today = new Date();
  const date = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysFromToday,
  );

  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function fillDateField(field: Locator, isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  const segments = field.getByRole("spinbutton");

  await expect(segments).toHaveCount(3);
  for (const [index, value] of [day, month, year].entries()) {
    await segments.nth(index).click();
    await segments.nth(index).pressSequentially(value);
  }
}

export function ariaField(root: Page | Locator, label: string) {
  return root
    .locator('[data-slot="select"], [data-slot="date-time-field"]')
    .filter({ hasText: label });
}
