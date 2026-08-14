import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stylesSource, pageHeaderSource, promosSource, shellSource] =
  await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/page-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(app)/promos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8"),
  ]);

test("page headers and content share a bounded operational workspace", () => {
  assert.match(pageHeaderSource, /page-header-inner/);
  assert.match(pageHeaderSource, /page-header-copy/);
  assert.match(stylesSource, /--layout-max: 100rem/);
  assert.match(stylesSource, /max-width: var\(--layout-max\)/);
  assert.match(
    stylesSource,
    /max-width: calc\(var\(--layout-max\) \+ \(2 \* var\(--layout-gutter\)\)\)/,
  );
});

test("layout keeps the full navigation and four-card dashboard intact", () => {
  assert.equal(
    (shellSource.match(/href: "\/(dashboard|products|inbound|manual|marketplace|promos|returns|opname|reconciliation|integrity|notifications|ledger)"/g) ?? [])
      .length,
    12,
  );
  assert.doesNotMatch(shellSource, /nav-section-disclosure/);
});

test("task grids follow their content weight and collapse predictably", () => {
  assert.match(promosSource, /balanced-command-grid/);
  assert.match(
    stylesSource,
    /\.balanced-command-grid \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    stylesSource,
    /@media \(max-width: 1220px\)[\s\S]*?\.marketplace-command-grid,[\s\S]*?grid-template-columns: 1fr/,
  );
});
