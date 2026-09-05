import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const resultPageUrl = new URL("../src/pages/ScanResult.jsx", import.meta.url);

test("V35 state and responses stay bound to the initiating route baseline", async () => {
  const source = await readFile(resultPageUrl, "utf8");

  assert.match(source, /const emptyComparisonState = \(baselineScanId\) => \(\{/u);
  assert.match(source, /comparisonState\.baselineScanId === id[\s\S]*emptyComparisonState\(id\)/u);
  assert.match(source, /multiviewRequestSequence\.current \+= 1;[\s\S]*setComparisonState\(emptyComparisonState\(id\)\)/u);
  assert.match(source, /const baselineScanId = id;[\s\S]*const requestId = multiviewRequestSequence\.current \+ 1/u);
  assert.match(source, /multiviewRequestSequence\.current !== requestId/u);
  assert.match(source, /current\.baselineScanId === baselineScanId && current\.pendingRequestId === requestId/u);
});

test("changing V35 inputs clears attributed output before another comparison", async () => {
  const source = await readFile(resultPageUrl, "utf8");

  const clearOnChange = /current\.baselineScanId === id\s*\? \{ \.\.\.current, (?:comparisonScanId|transform), result: null, error: "" \}/gu;
  assert.equal([...source.matchAll(clearOnChange)].length, 2);
  assert.match(source, /disabled=\{activeComparison\.pendingRequestId != null\}/u);
  assert.match(source, /The V35 response failed its diagnostic-only contract and was not displayed\./u);
});

test("current HARRY records fail closed when capability binding or V34/V36 output is invalid", async () => {
  const source = await readFile(resultPageUrl, "utf8");

  assert.match(source, /currentAnalyzerDiagnosticViews\(result\)/u);
  assert.match(source, /hasCurrentHarryMarker && !isCurrentCapabilityBoundHarry/u);
  assert.match(source, /isCurrentCapabilityBoundHarry && !v34\?\.available/u);
  assert.match(source, /isCurrentCapabilityBoundHarry && !v36\?\.available/u);
  assert.match(source, /Fail-closed capability warning:/u);
  assert.match(source, /not shown because the stored \$\{ANALYZER_IDENTITY\} identity or capability-manifest binding is incomplete or invalid/u);
  assert.match(source, /not present in this legacy or historical record/u);
});
