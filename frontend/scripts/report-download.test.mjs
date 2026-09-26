import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";
import { createReportDownloadSession, reportErrorDetail } from "../src/lib/reportDownload.mjs";

const bytes = Buffer.from("%PDF-1.4\ncontrolled report bytes\n%%EOF");
const envelope = "a".repeat(64);
const headers = {
  "Content-Type": "application/pdf",
  "X-Integrity-Scope": "scan-result-envelope",
  "X-Integrity-Hash": envelope,
  "X-Report-SHA256": createHash("sha256").update(bytes).digest("hex"),
};

function setup() {
  const created = [];
  const revoked = [];
  const session = createReportDownloadSession({
    scanId: "record-one", scanResultEnvelopeHash: envelope,
    cryptoImplementation: webcrypto,
    urlApi: {
      createObjectURL(blob) { created.push(blob); return `blob:report-${created.length}`; },
      revokeObjectURL(url) { revoked.push(url); },
    },
  });
  session.activate();
  return { session, created, revoked };
}

test("verified bytes remain downloadable without another report generation", async () => {
  const { session, created, revoked } = setup();
  const request = session.begin();
  assert.equal(session.begin(), null, "reject double clicks while the request is pending");
  const result = await session.prepare(new Blob([bytes]), headers, request);
  session.finish(request);
  assert.equal(result.href, "blob:report-1");
  assert.equal(result.filename, "soniccheck-evidence-record-one.pdf");
  assert.equal(result.reportSha256, headers["X-Report-SHA256"]);
  assert.equal(created.length, 1);
  assert.deepEqual(revoked, [], "retain the URL for native save/retry gestures");
  assert.equal(session.begin(), null, "reuse the prepared report instead of spending again");
  session.dispose();
  session.dispose();
  assert.deepEqual(revoked, [result.href], "revoke exactly once when leaving the context");
});

test("wrong-record, tampered and non-PDF bodies never get download links", async () => {
  for (const [body, responseHeaders] of [
    [bytes, { ...headers, "X-Integrity-Hash": "b".repeat(64) }],
    [Buffer.from("%PDF-tampered"), headers],
    [Buffer.from('{"detail":"denied"}'), { ...headers, "Content-Type": "application/json" }],
  ]) {
    const { session, created } = setup();
    const request = session.begin();
    await assert.rejects(session.prepare(new Blob([body]), responseHeaders, request));
    session.finish(request);
    assert.equal(created.length, 0);
    assert.notEqual(session.begin(), null, "an unsuccessful request can be retried");
  }
});

test("navigation during verification prevents a late private download URL", async () => {
  const { session, created } = setup();
  let release;
  const blob = { arrayBuffer: () => new Promise(resolve => { release = resolve; }) };
  const request = session.begin();
  const preparing = session.prepare(blob, headers, request);
  session.dispose();
  release(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(await preparing, null);
  assert.equal(created.length, 0);
  assert.equal(session.begin(), null);
});

test("effect cleanup/setup cycles do not resurrect old responses or disable new requests", async () => {
  const { session, created } = setup();
  const oldRequest = session.begin();
  session.dispose();
  session.activate();
  const newRequest = session.begin();
  assert.notEqual(newRequest, oldRequest);
  assert.equal(await session.prepare(new Blob([bytes]), headers, oldRequest), null);
  session.finish(oldRequest);
  assert.equal(session.isCurrent(newRequest), true);
  assert.ok(await session.prepare(new Blob([bytes]), headers, newRequest));
  assert.equal(created.length, 1);
});

test("PDF request errors expose bounded JSON details instead of losing Blob errors", async () => {
  assert.equal(await reportErrorDetail({ detail: "Report unavailable" }), "Report unavailable");
  assert.equal(await reportErrorDetail(new Blob(['{"detail":"No report credit"}'])), "No report credit");
  assert.equal(await reportErrorDetail(new Blob(["not JSON"])), undefined);
  let read = false;
  assert.equal(await reportErrorDetail({ size: 65_537, text() { read = true; } }), undefined);
  assert.equal(read, false);
});
