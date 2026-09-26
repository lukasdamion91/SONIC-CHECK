import { verifyReportDelivery } from "./scanResultIntegrity.mjs";

/** Keep one verified report in memory until its record/account context closes. */
export function createReportDownloadSession({
  scanId,
  ownerId,
  scanResultEnvelopeHash,
  urlApi = URL,
  cryptoImplementation = globalThis.crypto,
}) {
  let closed = true;
  let pending = null;
  let sequence = 0;
  let download = null;
  const isCurrent = (request) => !closed && request != null && pending === request;
  return {
    activate() {
      closed = false;
    },
    isCurrent,
    begin() {
      if (closed || pending != null || download) return null;
      pending = ++sequence;
      return pending;
    },
    async prepare(blob, headers, request) {
      if (!isCurrent(request)) return null;
      const integrity = await verifyReportDelivery({
        blob, headers,
        expectedScanResultEnvelopeHash: scanResultEnvelopeHash,
        cryptoImplementation,
      });
      // Navigation/sign-out may happen while the bytes are being checked.
      if (!isCurrent(request)) return null;
      if (!download) {
        download = {
          scanId, ownerId,
          href: urlApi.createObjectURL(blob),
          filename: `soniccheck-evidence-${String(scanId).replace(/[^a-zA-Z0-9_-]/gu, "_")}.pdf`,
          ...integrity,
        };
      }
      return download;
    },
    finish(request) {
      if (pending === request) pending = null;
    },
    dispose() {
      closed = true;
      pending = null;
      sequence += 1;
      if (download) urlApi.revokeObjectURL(download.href);
      download = null;
    },
  };
}

/** Axios uses Blob responses for both PDFs and JSON error bodies. */
export async function reportErrorDetail(data) {
  if (data?.detail != null) return data.detail;
  if (typeof data?.text === "function" && data.size <= 65_536) {
    try { return JSON.parse(await data.text())?.detail; } catch { return undefined; }
  }
  return undefined;
}
