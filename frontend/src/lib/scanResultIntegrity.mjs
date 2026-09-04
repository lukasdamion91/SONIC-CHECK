const HASH_PATTERN = /^[0-9a-f]{64}$/;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export class ReportIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReportIntegrityError";
  }
}

const parseJsonDocument = (source) => {
  if (typeof source !== "string") {
    throw new ReportIntegrityError("The stored result was not received as JSON text for the integrity check.");
  }

  let cursor = 0;
  const fail = (message) => {
    throw new ReportIntegrityError(`The stored result could not be prepared for the integrity check (${message}).`);
  };
  const whitespace = () => {
    while (/\s/u.test(source[cursor] || "")) cursor += 1;
  };
  const stringNode = () => {
    if (source[cursor] !== '"') fail("expected a string");
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < source.length) {
      const character = source[cursor];
      cursor += 1;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        const raw = source.slice(start, cursor);
        try {
          return { type: "string", value: JSON.parse(raw) };
        } catch {
          fail("invalid string escape");
        }
      }
    }
    fail("unterminated string");
    return null;
  };

  const valueNode = () => {
    whitespace();
    const character = source[cursor];
    if (character === '"') return stringNode();
    if (character === "{") {
      cursor += 1;
      whitespace();
      const entries = [];
      const names = new Set();
      if (source[cursor] === "}") {
        cursor += 1;
        return { type: "object", entries };
      }
      while (cursor < source.length) {
        whitespace();
        const key = stringNode().value;
        if (names.has(key)) fail("duplicate object key");
        names.add(key);
        whitespace();
        if (source[cursor] !== ":") fail("expected ':'");
        cursor += 1;
        entries.push([key, valueNode()]);
        whitespace();
        if (source[cursor] === "}") {
          cursor += 1;
          return { type: "object", entries };
        }
        if (source[cursor] !== ",") fail("expected ','");
        cursor += 1;
      }
      fail("unterminated object");
    }
    if (character === "[") {
      cursor += 1;
      whitespace();
      const items = [];
      if (source[cursor] === "]") {
        cursor += 1;
        return { type: "array", items };
      }
      while (cursor < source.length) {
        items.push(valueNode());
        whitespace();
        if (source[cursor] === "]") {
          cursor += 1;
          return { type: "array", items };
        }
        if (source[cursor] !== ",") fail("expected ','");
        cursor += 1;
      }
      fail("unterminated array");
    }
    for (const [literal, value] of [["true", true], ["false", false], ["null", null]]) {
      if (source.startsWith(literal, cursor)) {
        cursor += literal.length;
        return { type: "literal", value };
      }
    }
    const number = source.slice(cursor).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number) {
      cursor += number.length;
      return { type: "number", raw: number };
    }
    fail("unexpected token");
    return null;
  };

  const root = valueNode();
  whitespace();
  if (cursor !== source.length) fail("trailing content");
  return root;
};

const materialise = (node) => {
  if (node.type === "string" || node.type === "literal") return node.value;
  if (node.type === "number") return Number(node.raw);
  if (node.type === "array") return node.items.map(materialise);
  return Object.fromEntries(node.entries.map(([key, value]) => [key, materialise(value)]));
};

const pythonString = (value) => {
  let output = '"';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22) output += '\\"';
    else if (code === 0x5c) output += "\\\\";
    else if (code === 0x08) output += "\\b";
    else if (code === 0x09) output += "\\t";
    else if (code === 0x0a) output += "\\n";
    else if (code === 0x0c) output += "\\f";
    else if (code === 0x0d) output += "\\r";
    else if (code < 0x20 || code >= 0x7f) output += `\\u${code.toString(16).padStart(4, "0")}`;
    else output += value[index];
  }
  return `${output}"`;
};

const comparePythonKeys = (left, right) => {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0));
  const rightPoints = Array.from(right, (character) => character.codePointAt(0));
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
};

const canonicalPythonJson = (node) => {
  if (node.type === "string") return pythonString(node.value);
  if (node.type === "number") return node.raw;
  if (node.type === "literal") {
    if (node.value === null) return "null";
    return node.value ? "true" : "false";
  }
  if (node.type === "array") return `[${node.items.map(canonicalPythonJson).join(", ")}]`;
  const entries = [...node.entries].sort(([left], [right]) => comparePythonKeys(left, right));
  return `{${entries.map(([key, value]) => `${pythonString(key)}: ${canonicalPythonJson(value)}`).join(", ")}}`;
};

const objectEntry = (node, name) => (
  node?.type === "object" ? node.entries.find(([key]) => key === name)?.[1] : undefined
);

const sha256Hex = async (value, cryptoImplementation = globalThis.crypto) => {
  if (!cryptoImplementation?.subtle?.digest) {
    throw new ReportIntegrityError("Cryptographic integrity checks are unavailable in this browser.");
  }
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await cryptoImplementation.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * Parse a Python-served JSON response without losing the distinction between
 * integer and floating-point number tokens, then reproduce json.dumps(...,
 * sort_keys=True) over the report's FastAPI-normalised {scan_id, result}
 * scope. Numeric lexemes remain exact so an unexpected serializer change
 * fails the later consistency check closed.
 */
export async function prepareScanResultIntegrity(rawScanJson, cryptoImplementation = globalThis.crypto) {
  const root = parseJsonDocument(rawScanJson);
  const idNode = objectEntry(root, "id");
  const resultNode = objectEntry(root, "result");
  if (idNode?.type !== "string" || resultNode?.type !== "object") {
    throw new ReportIntegrityError("The stored result is missing the scan ID or analysis object required by the integrity check.");
  }
  const payload = {
    type: "object",
    entries: [["scan_id", idNode], ["result", resultNode]],
  };
  return {
    scan: materialise(root),
    scanResultEnvelopeHash: await sha256Hex(canonicalPythonJson(payload), cryptoImplementation),
  };
}

const responseHeader = (headers, name) => {
  const viaGetter = headers?.get?.(name);
  if (viaGetter != null) return String(viaGetter);
  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === lowerName);
  return entry ? String(entry[1]) : "";
};

const requiredHashHeader = (headers, name) => {
  const value = responseHeader(headers, name).trim().toLowerCase();
  if (!HASH_PATTERN.test(value)) {
    throw new ReportIntegrityError(`Report download blocked: ${name} was missing or invalid.`);
  }
  return value;
};

export async function verifyReportDelivery({
  blob,
  headers,
  expectedScanResultEnvelopeHash,
  cryptoImplementation = globalThis.crypto,
}) {
  const expected = String(expectedScanResultEnvelopeHash || "").toLowerCase();
  if (!HASH_PATTERN.test(expected)) {
    throw new ReportIntegrityError("Report download blocked: the locally loaded scan-result envelope has no valid integrity hash.");
  }
  if (responseHeader(headers, "X-Integrity-Scope").trim() !== "scan-result-envelope") {
    throw new ReportIntegrityError("Report download blocked: the scan-result envelope hash scope was missing or unexpected.");
  }
  const deliveredEnvelopeHash = requiredHashHeader(headers, "X-Integrity-Hash");
  if (deliveredEnvelopeHash !== expected) {
    throw new ReportIntegrityError("Report download blocked: the PDF does not correspond to the locally loaded scan-result envelope.");
  }
  const deliveredPdfHash = requiredHashHeader(headers, "X-Report-SHA256");
  const mediaType = responseHeader(headers, "Content-Type").split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/pdf") {
    throw new ReportIntegrityError("Report download blocked: the response was not identified as a PDF.");
  }
  if (!blob?.arrayBuffer) {
    throw new ReportIntegrityError("Report download blocked: the PDF bytes could not be checked.");
  }
  const pdfBuffer = await blob.arrayBuffer();
  const pdfBytes = new Uint8Array(pdfBuffer);
  if (!PDF_MAGIC.every((byte, index) => pdfBytes[index] === byte)) {
    throw new ReportIntegrityError("Report download blocked: the response did not contain a valid PDF header.");
  }
  const localPdfHash = await sha256Hex(pdfBuffer, cryptoImplementation);
  if (deliveredPdfHash !== localPdfHash) {
    throw new ReportIntegrityError("Report download blocked: the downloaded PDF bytes did not match the delivered integrity hash.");
  }
  return { scanResultEnvelopeHash: expected, reportSha256: localPdfHash };
}
