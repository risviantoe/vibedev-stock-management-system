import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [shellSource, headerSource, layoutSource, stylesSource] = await Promise.all([
  readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/page-header.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("operational navigation is grouped by the admin's mental model", () => {
  assert.match(shellSource, /label: "Ringkasan"/);
  assert.match(shellSource, /label: "Operasional"/);
  assert.match(shellSource, /label: "Pengawasan"/);
  assert.match(shellSource, /className="nav-section"/);
  assert.match(shellSource, /role="group"/);
});

test("page headers prioritize the task before supporting context", () => {
  const titleIndex = headerSource.indexOf("<h1>{title}</h1>");
  const contextIndex = headerSource.indexOf('className="page-context"');

  assert.ok(titleIndex >= 0);
  assert.ok(contextIndex > titleIndex);
  assert.doesNotMatch(headerSource, /className="eyebrow"/);
});

test("shared controls provide visible focus and practical target sizes", () => {
  assert.match(stylesSource, /--focus-ring:/);
  assert.match(stylesSource, /\.primary-button:focus-visible/);
  assert.match(stylesSource, /\.pagination-number:focus-visible/);
  assert.match(stylesSource, /\.aria-calendar-cell\[data-focus-visible\]/);
  assert.match(stylesSource, /\.pagination-number,[\s\S]*min-height: 2\.75rem/);
  assert.match(stylesSource, /\.aria-calendar-cell \{[\s\S]*height: 2\.5rem/);
  assert.doesNotMatch(stylesSource, /var\(--lime\)/);
});

test("tablet navigation keeps its labels, icons, and account layout intact", () => {
  assert.match(stylesSource, /\.sidebar \.nav-item span:first-child/);
  assert.doesNotMatch(stylesSource, /\n\s*\.nav-item span:first-child,/);
  assert.match(
    stylesSource,
    /\.navigation-dialog \.primary-nav \.nav-item \{[\s\S]*grid-template-columns: 1\.8rem minmax\(0, 1fr\) auto/,
  );
  assert.match(stylesSource, /\.navigation-dialog \.primary-nav \.nav-glyph \{\s*display: grid/);
  assert.match(stylesSource, /\.navigation-dialog \.primary-nav \.nav-label \{[\s\S]*white-space: nowrap/);
  assert.match(stylesSource, /height: 100dvh/);
  assert.match(layoutSource, /viewportFit: "cover"/);
});
