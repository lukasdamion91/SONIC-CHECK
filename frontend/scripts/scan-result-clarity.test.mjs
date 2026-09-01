import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHash, webcrypto } from "node:crypto";

import {
  prepareScanResultIntegrity,
  ReportIntegrityError,
  verifyReportDelivery,
} from "../src/lib/scanResultIntegrity.mjs";
import {
  buildChannelCoverageRows,
  compositionComparisonDisclosure,
} from "../src/lib/scanResultPresentation.mjs";
import {
  copyTextBestEffort,
  refreshAfterCreditAttempt,
} from "../src/lib/userActions.mjs";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("scan-result envelope hashing exactly reproduces Python json.dumps without losing float tokens", async () => {
  const rawScanJson = '{"id":"scan-😀","result":{"z":1.0,"a":"café\\n","nested":[-0.0,1e-06,true,null]}}';
  const prepared = await prepareScanResultIntegrity(rawScanJson, webcrypto);

  assert.equal(prepared.scan.id, "scan-😀");
  assert.equal(prepared.scan.result.z, 1);
  assert.equal(
    prepared.scanResultEnvelopeHash,
    "b34d5672630de6312e18564cfa43f8a02920d64f88c0e1fdac0b89bb358eba2c",
  );
});

test("report delivery verifies both the scan-result envelope scope and exact PDF bytes", async () => {
  const bytes = new TextEncoder().encode("%PDF-controlled-report");
  const verified = await verifyReportDelivery({
    blob: new Blob([bytes], { type: "application/pdf" }),
    headers: {
      "content-type": "application/pdf; charset=binary",
      "x-integrity-scope": "scan-result-envelope",
      "x-integrity-hash": "b34d5672630de6312e18564cfa43f8a02920d64f88c0e1fdac0b89bb358eba2c",
      "x-report-sha256": "ed6d03f63dbe08910f236b9816787e86ce96a2be5d98ff2032c986f472b5499a",
    },
    expectedScanResultEnvelopeHash: "b34d5672630de6312e18564cfa43f8a02920d64f88c0e1fdac0b89bb358eba2c",
    cryptoImplementation: webcrypto,
  });

  assert.equal(verified.reportSha256, "ed6d03f63dbe08910f236b9816787e86ce96a2be5d98ff2032c986f472b5499a");
});

test("report delivery fails closed for missing, stale or mismatched integrity metadata", async () => {
  const blob = new Blob(["%PDF-changed-pdf"], { type: "application/pdf" });
  const base = {
    blob,
    expectedScanResultEnvelopeHash: "a".repeat(64),
    cryptoImplementation: webcrypto,
  };

  await assert.rejects(
    verifyReportDelivery({ ...base, headers: {} }),
    (error) => error instanceof ReportIntegrityError && /scope was missing/u.test(error.message),
  );
  await assert.rejects(
    verifyReportDelivery({
      ...base,
      headers: {
        "content-type": "application/pdf",
        "x-integrity-scope": "scan-result-envelope",
        "x-integrity-hash": "b".repeat(64),
        "x-report-sha256": "c".repeat(64),
      },
    }),
    /does not correspond/u,
  );
  await assert.rejects(
    verifyReportDelivery({
      ...base,
      headers: {
        "content-type": "application/pdf",
        "x-integrity-scope": "scan-result-envelope",
        "x-integrity-hash": "a".repeat(64),
        "x-report-sha256": "c".repeat(64),
      },
    }),
    /did not match the delivered integrity hash/u,
  );
});

test("report delivery requires a PDF media type and PDF file signature", async () => {
  const analysisHash = "a".repeat(64);
  const pdfBytes = new TextEncoder().encode("%PDF-controlled");
  const badMagicBytes = new TextEncoder().encode("<html>not a PDF</html>");
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const baseHeaders = {
    "x-integrity-scope": "scan-result-envelope",
    "x-integrity-hash": analysisHash,
  };

  await assert.rejects(
    verifyReportDelivery({
      blob: new Blob([pdfBytes], { type: "text/plain" }),
      headers: {
        ...baseHeaders,
        "content-type": "text/plain",
        "x-report-sha256": sha256(pdfBytes),
      },
      expectedScanResultEnvelopeHash: analysisHash,
      cryptoImplementation: webcrypto,
    }),
    /not identified as a PDF/u,
  );

  await assert.rejects(
    verifyReportDelivery({
      blob: new Blob([badMagicBytes], { type: "application/pdf" }),
      headers: {
        ...baseHeaders,
        "content-type": "application/pdf; version=1.7",
        "x-report-sha256": sha256(badMagicBytes),
      },
      expectedScanResultEnvelopeHash: analysisHash,
      cryptoImplementation: webcrypto,
    }),
    /valid PDF header/u,
  );
});

test("noncanonical numeric response lexemes fail closed against the Python report hash", async () => {
  const prepared = await prepareScanResultIntegrity(
    '{"id":"s","result":{"x":1e0}}',
    webcrypto,
  );
  const pdfBytes = new TextEncoder().encode("%PDF-controlled");

  assert.equal(
    prepared.scanResultEnvelopeHash,
    "38be079ee72bc33a68117696f49be48a0c6b4fc455c9e4e7db99aa5e5a751c40",
  );
  await assert.rejects(
    verifyReportDelivery({
      blob: new Blob([pdfBytes], { type: "application/pdf" }),
      headers: {
        "content-type": "application/pdf",
        "x-integrity-scope": "scan-result-envelope",
        // Python json.loads + json.dumps writes this value as 1.0.
        "x-integrity-hash": "f6cf2432f89f79eb25cc3fa9eaaf0e5ce841a0cb6881c767c7e5186b1e5af1ee",
        "x-report-sha256": createHash("sha256").update(pdfBytes).digest("hex"),
      },
      expectedScanResultEnvelopeHash: prepared.scanResultEnvelopeHash,
      cryptoImplementation: webcrypto,
    }),
    /does not correspond/u,
  );
});

test("badge publication remains successful when clipboard permission is denied", async () => {
  let attempted = 0;
  const copied = await copyTextBestEffort("https://soniccheck.io/verify/controlled", {
    async writeText() {
      attempted += 1;
      throw new Error("clipboard denied");
    },
  });
  assert.equal(attempted, 1);
  assert.equal(copied, false);
  assert.equal(await copyTextBestEffort("value", null), false);
  assert.equal(await copyTextBestEffort("value", { writeText: async () => undefined }), true);
});

test("every credit-consuming report attempt refreshes server-owned account state", async () => {
  let refreshes = 0;
  assert.equal(await refreshAfterCreditAttempt(false, async () => { refreshes += 1; }), false);
  assert.equal(refreshes, 0);
  assert.equal(await refreshAfterCreditAttempt(true, async () => { refreshes += 1; }), true);
  assert.equal(refreshes, 1);
  assert.equal(await refreshAfterCreditAttempt(true, async () => {
    refreshes += 1;
    throw new Error("profile temporarily unavailable");
  }), true);
  assert.equal(refreshes, 2);
});

test("channel coverage keeps not-submitted, searched, degraded and comparison states distinct", () => {
  const emptyRows = buildChannelCoverageRows({
    scan_modes: { audio: false, lyrics: false },
    composition_analysis: { status: "AUDIO_NOT_SUBMITTED", comparisons: [] },
  });
  assert.deepEqual(emptyRows.map((row) => row.state), ["not_submitted", "not_submitted", "not_submitted"]);

  const rows = buildChannelCoverageRows({
    scan_modes: { audio: true, lyrics: true },
    audio_input: { status: "DECODED" },
    fingerprint: { status_code: 1001, status_msg: "No result" },
    lyric_analysis: { source_usable: true, candidates_checked: 4 },
    matches: [],
    composition_analysis: {
      status: "COMPLETED_RESEARCH_ONLY",
      catalogue_entries_considered: 3,
      successful_comparison_count: 2,
      references_unavailable: 1,
      comparisons: [
        { reference_id: "one", composition_signal_percent: 40.0 },
        { reference_id: "two", composition_signal_percent: 10.0 },
        { reference_id: "three", composition_signal_percent: null },
      ],
    },
  });
  assert.deepEqual(rows.map((row) => row.state), [
    "searched_no_candidate",
    "searched_no_candidate",
    "comparison_coverage",
  ]);
  assert.match(rows[2].coverage, /2 of 3 selected references compared; 1 unavailable/u);

  const degraded = buildChannelCoverageRows({
    scan_modes: { audio: true, lyrics: true },
    audio_input: { status: "DECODED" },
    fingerprint: { status_code: 3000, status_msg: "Provider unavailable" },
    lyric_analysis: { source_usable: false, summary: "Discovery unavailable" },
    composition_analysis: { status: "RETRIEVAL_QUERY_FAILED", reason: "Index unavailable", comparisons: [] },
  });
  assert.deepEqual(degraded.map((row) => row.state), [
    "unavailable_degraded",
    "unavailable_degraded",
    "unavailable_degraded",
  ]);
});

test("composition disclosure states comparison count, top-of-n scope and no adjustment", () => {
  const disclosure = compositionComparisonDisclosure({
    catalogue_entries_considered: 4,
    successful_comparison_count: 3,
    comparisons: [
      { composition_signal_percent: 70 },
      { composition_signal_percent: 60 },
      { composition_signal_percent: 50 },
      { composition_signal_percent: null },
    ],
  });

  assert.equal(disclosure.completedCount, 3);
  assert.equal(disclosure.consideredCount, 4);
  assert.match(disclosure.text, /top of 3 successful comparisons among 4 selected references/u);
  assert.match(disclosure.text, /No multiple-comparison adjustment was applied/u);
});

test("result source gates actions by API capabilities and preserves interpretation limits", async () => {
  const resultSource = await source("../src/pages/ScanResult.jsx");

  assert.match(resultSource, /const \{ user, refresh \} = useAuth\(\)/u);
  assert.match(resultSource, /resolveAccessPolicy\(user\)/u);
  assert.match(resultSource, /report_credit_will_be_consumed/u);
  assert.match(resultSource, /window\.confirm\([\s\S]*consume \$\{creditCopy\}/u);
  assert.match(resultSource, /prepareScanResultIntegrity\(data\)/u);
  assert.match(resultSource, /verifyReportDelivery\(\{/u);
  assert.match(resultSource, /await refreshAfterCreditAttempt\(/u);
  assert.match(resultSource, /const copied = await copyTextBestEffort\(url\)/u);
  assert.match(resultSource, /Public evidence-record link created; copy it manually/u);
  assert.match(resultSource, /Integrity-checked evidence report downloaded/u);
  assert.doesNotMatch(resultSource, /signer|authenticity|authentic report/iu);
  assert.match(resultSource, /disabled=\{Boolean\(action\) \|\| !accessPolicy\.can_create_badge\}/u);
  assert.match(resultSource, /icon: FileSearch/u);
  assert.doesNotMatch(resultSource, /icon: CheckCircle2/u);
  assert.match(resultSource, /Aggregate evidence score/u);
  assert.doesNotMatch(resultSource, /label="Evidence confidence"/u);
  assert.match(resultSource, /measurement quality/u);
  assert.match(resultSource, /No result establishes authorship, ownership or legal clearance/u);
  assert.match(resultSource, /Unpublish this public evidence-record link/u);
});
