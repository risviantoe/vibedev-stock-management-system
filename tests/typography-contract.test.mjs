import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [layoutSource, stylesSource, packageSource] = await Promise.all([
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("Inter Variable is bundled instead of relying on a local system font", () => {
  const packageJson = JSON.parse(packageSource);

  assert.ok(packageJson.dependencies["@fontsource-variable/inter"]);
  assert.match(layoutSource, /import "@fontsource-variable\/inter"/);
  assert.match(stylesSource, /--font-sans: "Inter Variable"/);
  assert.match(stylesSource, /font-family: var\(--font-sans\)/);
});

test("operational typography uses shared readable scale tokens", () => {
  for (const token of [
    "--text-2xs: 0.75rem",
    "--text-xs: 0.8125rem",
    "--text-sm: 0.875rem",
    "--text-base: 0.9375rem",
    "--text-xl: 1.25rem",
  ]) {
    assert.match(stylesSource, new RegExp(token.replace("--", "\\-\\-")));
  }

  assert.match(stylesSource, /\.data-table \{[\s\S]*font-size: var\(--text-xs\)/);
  assert.match(stylesSource, /\.aria-field-label[\s\S]*font-size: var\(--text-xs\)/);
  assert.match(stylesSource, /\.operational-shell \.page-header h1[\s\S]*2\.75rem/);
  assert.match(stylesSource, /\.operational-shell \.identifier[\s\S]*font-family: var\(--font-mono\)/);
});
