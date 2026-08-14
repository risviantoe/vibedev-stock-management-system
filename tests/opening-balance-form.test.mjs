import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formSource = await readFile(
  new URL("../components/forms/opening-balance-form.tsx", import.meta.url),
  "utf8",
);

test("opening balance resolves a valid batch after the batch list refreshes", () => {
  assert.match(
    formSource,
    /const resolvedBatchId = eligibleBatches\.some\([\s\S]*eligibleBatches\[0\]\?\.id/,
  );
  assert.match(formSource, /batchId: resolvedBatchId/);
  assert.match(formSource, /value=\{resolvedBatchId\}/);
});
