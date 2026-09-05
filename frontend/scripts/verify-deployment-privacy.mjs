import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = "soniccheck-deployment-privacy/1.2.0";
const ALLOWLIST_REVISION = "soniccheck-static-artifact-allowlist/1.0.0";
const SHA256 = /^[a-f0-9]{64}$/u;

const AUDIO_EXTENSION = /\.(?:aac|ac3|aif|aiff|alac|amr|ape|au|caf|flac|m4a|mid|midi|mp2|mp3|oga|ogg|opus|pcm|ra|ram|snd|wav|wave|wma|wv)$/iu;
const TEXT_STATIC_EXTENSION = /\.(?:css|html?|js|json|mjs|txt|xml)$/iu;
const AUDIO_DATA_URI = /\bdata:audio\/[a-z0-9.+-]+(?:;[a-z0-9.+-]+=[^;,\s]+)*(?:;base64)?,/iu;
const AUDIO_BASE64_PREFIX = /(?:^|[^A-Za-z0-9+/_-])((?:UklGR|Rk9STQ|ZkxhQw|T2dnUw|SUQz)[A-Za-z0-9+/_-]{12,}={0,2})/gu;
const PRIVATE_PATH = /(?:^|\/)(?:corpus|custody|evidence|fixtures?|internal|operations|private-corpus|private-custody|project-sources?|project_sources?|research|research-evidence|tests?|validation)(?:\/|$)/iu;
const FORBIDDEN_BASENAME = /(?:^|\/)(?:\.env(?:\..*)?|\.git(?:ignore|modules)?|dockerfile|package-lock\.json|package\.json|yarn\.lock|pnpm-lock\.yaml|readme(?:\..*)?)(?:$|\/)/iu;

const IMAGE_EXTENSION = "(?:apng|avif|gif|ico|jpe?g|png|svg|webp)";
const FONT_EXTENSION = "(?:eot|otf|ttf|woff2?)";
const STATIC_PATH_ALLOWLIST = [
  /^(?:404\.html|CNAME|_headers|_redirects|asset-manifest\.json|browserconfig\.xml|favicon(?:-[a-z0-9-]+)?\.(?:ico|png|svg)|index\.html|manifest\.json|robots\.txt|site\.webmanifest|sitemap\.xml)$/u,
  /^(?:[a-z0-9][a-z0-9-]*\/)+index\.html$/u,
  new RegExp(`^brand/[a-zA-Z0-9._-]+\\.${IMAGE_EXTENSION}$`, "u"),
  new RegExp(`^(?:assets|images)/[a-zA-Z0-9._/-]+\\.${IMAGE_EXTENSION}$`, "u"),
  new RegExp(`^(?:assets/)?fonts/[a-zA-Z0-9._/-]+\\.${FONT_EXTENSION}$`, "u"),
  /^static\/css\/[a-zA-Z0-9._-]+\.css$/u,
  /^static\/js\/[a-zA-Z0-9._-]+\.(?:js|mjs|js\.LICENSE\.txt)$/u,
  new RegExp(`^static/media/[a-zA-Z0-9._-]+\\.(?:${IMAGE_EXTENSION}|${FONT_EXTENSION})$`, "u"),
];

const SECRET_PATTERNS = [
  { name: "private-key", pattern: /-----BEGIN (?:DSA |EC |OPENSSH |PGP |RSA )?PRIVATE KEY-----/gu },
  { name: "acr-credential", pattern: /\bACR_(?:ACCESS_KEY|ACCESS_SECRET)\b\s*[=:]\s*["']?[A-Za-z0-9/+_-]{12,}/gu },
  { name: "stripe-secret", pattern: /\b(?:rk|sk)_(?:live|test)_[A-Za-z0-9]{16,}\b/gu },
  { name: "stripe-webhook-secret", pattern: /\bwhsec_[A-Za-z0-9_-]{16,}\b/gu },
  { name: "openai-secret", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/gu },
  { name: "anthropic-secret", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/gu },
  { name: "github-token", pattern: /\b(?:gh[opsru]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/gu },
  { name: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/gu },
  { name: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu },
  { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/gu },
  { name: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{30,}\b/gu },
  { name: "sendgrid-key", pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/gu },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu },
  { name: "authorization-bearer", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gu },
  { name: "credential-url", pattern: /\b(?:mongodb(?:\+srv)?|mysql|postgres(?:ql)?|redis):\/\/[^\s:/]+:[^\s/@]+@/giu },
  {
    name: "assigned-secret",
    pattern: /\b(?:ACR_ACCESS_KEY|ACR_ACCESS_SECRET|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|refresh[_-]?token|secret[_-]?key|password|passwd|private[_-]?key)\b\s*[=:]\s*["']?(?=[A-Za-z0-9+/_.-]{16,})(?=[A-Za-z0-9+/_.-]*[0-9])[A-Za-z0-9+/_.-]{16,}/giu,
  },
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function audioMagic(buffer) {
  if (buffer.length >= 12) {
    const firstFour = buffer.subarray(0, 4).toString("latin1");
    const eightToTwelve = buffer.subarray(8, 12).toString("latin1");
    if (firstFour === "RIFF" && eightToTwelve === "WAVE") return true;
    if (firstFour === "FORM" && ["AIFF", "AIFC"].includes(eightToTwelve)) return true;
  }
  const four = buffer.subarray(0, 4).toString("latin1");
  const three = buffer.subarray(0, 3).toString("latin1");
  if (["fLaC", "OggS", "caff", "MThd", "MAC ", "wvpk", ".snd"].includes(four)) return true;
  if (three === "ID3" || buffer.subarray(0, 5).toString("latin1") === "#!AMR") return true;
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("latin1") === "ftyp") return true;
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return true;
  return buffer.length >= 16
    && buffer.subarray(0, 16).equals(Buffer.from("3026b2758e66cf11a6d900aa0062ce6c", "hex"));
}

function audioMagicAtAnyOffset(buffer) {
  const markers = ["RIFF", "FORM", "fLaC", "OggS", "ID3", "#!AMR"]
    .map((value) => Buffer.from(value, "ascii"));
  for (const marker of markers) {
    let offset = buffer.indexOf(marker);
    while (offset >= 0) {
      if (audioMagic(buffer.subarray(offset))) return true;
      offset = buffer.indexOf(marker, offset + 1);
    }
  }
  for (let offset = 0; offset + 1 < buffer.length; offset += 1) {
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) return true;
  }
  return false;
}

function embeddedAudioKind(buffer) {
  const text = buffer.toString("latin1");
  if (AUDIO_DATA_URI.test(text)) return "audio-data-uri";
  AUDIO_BASE64_PREFIX.lastIndex = 0;
  for (const match of text.matchAll(AUDIO_BASE64_PREFIX)) {
    const normalized = match[1].replace(/-/gu, "+").replace(/_/gu, "/");
    const decoded = Buffer.from(normalized, "base64");
    if (audioMagic(decoded)) return "base64-audio-signature";
  }
  return audioMagicAtAnyOffset(buffer) ? "embedded-audio-signature" : "";
}

function allowedStaticPath(relative) {
  return STATIC_PATH_ALLOWLIST.some((pattern) => pattern.test(relative));
}

function secretKinds(buffer) {
  const text = buffer.toString("latin1");
  return SECRET_PATTERNS
    .filter(({ pattern }) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    })
    .map(({ name }) => name)
    .sort();
}

function canonicalManifest(manifest) {
  return `${JSON.stringify(manifest)}\n`;
}

function pathSha256(value) {
  return sha256(`soniccheck-static-path\n${value}`);
}

function sortViolations(violations) {
  return violations.sort((left, right) => (
    left.path.localeCompare(right.path)
    || left.code.localeCompare(right.code)
    || left.detail.localeCompare(right.detail)
  ));
}

function receiptFor({ manifest = [], bytesScanned = 0, violations = [], expectedArtifactSha256 = "" }) {
  const sortedViolations = sortViolations(violations);
  const failed = sortedViolations.length > 0;
  const digestManifest = manifest.map(({ path: manifestPath, size_bytes: sizeBytes, sha256: fileSha256 }) => ({
    path_sha256: pathSha256(manifestPath),
    size_bytes: sizeBytes,
    sha256: fileSha256,
  }));
  const canonical = canonicalManifest(digestManifest);
  const manifestSha256 = sha256(canonical);
  const artifactSha256 = sha256(`${ALLOWLIST_REVISION}\n${canonical}`);
  const codes = new Set(sortedViolations.map(({ code }) => code));
  const publicManifest = failed
    ? digestManifest
    : manifest;
  const publicViolations = sortedViolations.map(({ code, path: violationPath, detail }) => ({
    code,
    path_sha256: pathSha256(violationPath),
    detail,
  }));
  return {
    schema_version: SCHEMA_VERSION,
    status: failed ? "FAIL" : "PASS",
    allowlist_revision: ALLOWLIST_REVISION,
    artifact_sha256: artifactSha256,
    expected_artifact_sha256: expectedArtifactSha256 || null,
    file_manifest_sha256: manifestSha256,
    files_scanned: manifest.length,
    bytes_scanned: bytesScanned,
    manifest_paths_redacted: failed,
    file_manifest: publicManifest,
    checks: {
      all_regular_file_bytes_scanned: ![
        "ARTIFACT_ROOT_NOT_DIRECTORY",
        "ARTIFACT_ROOT_UNREADABLE",
        "DIRECTORY_READ_FAILED",
        "FILE_READ_FAILED",
      ].some((code) => codes.has(code)),
      allowed_static_paths_only: !codes.has("UNEXPECTED_STATIC_PATH"),
      no_symbolic_or_special_files: !codes.has("SYMBOLIC_LINK") && !codes.has("SPECIAL_FILE"),
      artifact_digest_matches_build_receipt: expectedArtifactSha256 ? artifactSha256 === expectedArtifactSha256 : null,
    },
    private_research_evidence_present: codes.has("PRIVATE_RESEARCH_PATH"),
    raw_audio_present: codes.has("AUDIO_PATH")
      || codes.has("AUDIO_SIGNATURE")
      || codes.has("AUDIO_EMBEDDED_SIGNATURE"),
    secret_material_present: codes.has("SECRET_MATERIAL"),
    content_classification_scope: "EXACT_STATIC_PATH_ALLOWLIST_AND_RECOGNIZED_BYTE_OR_ENCODING_SIGNATURES",
    semantic_content_classification_claimed: false,
    violations: publicViolations,
  };
}

class DeploymentPrivacyError extends Error {
  constructor(receipt) {
    const counts = receipt.violations.reduce((result, { code }) => {
      result[code] = (result[code] || 0) + 1;
      return result;
    }, {});
    const summary = Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `${code}=${count}`)
      .join(",");
    super(`deployment privacy verification failed (${summary}); see structured receipt`);
    this.name = "DeploymentPrivacyError";
    this.receipt = receipt;
  }
}

async function inventory(root, violations) {
  const pending = [root];
  const files = [];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      const relative = path.relative(root, directory).split(path.sep).join("/") || ".";
      violations.push({ code: "DIRECTORY_READ_FAILED", path: relative, detail: "directory could not be inventoried" });
      continue;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isSymbolicLink()) {
        violations.push({ code: "SYMBOLIC_LINK", path: relative, detail: "links are not deployable static files" });
      } else if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile()) {
        files.push({ absolute, relative });
      } else {
        violations.push({ code: "SPECIAL_FILE", path: relative, detail: "non-regular filesystem entry" });
      }
    }
  }
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}

export async function verifyDeploymentPrivacy(root, { expectedArtifactSha256 = "" } = {}) {
  const violations = [];
  let info;
  try {
    info = await lstat(root);
  } catch {
    const receipt = receiptFor({
      violations: [{ code: "ARTIFACT_ROOT_UNREADABLE", path: ".", detail: "deployment artifact root does not exist or is unreadable" }],
      expectedArtifactSha256,
    });
    throw new DeploymentPrivacyError(receipt);
  }
  if (!info.isDirectory()) {
    const receipt = receiptFor({
      violations: [{ code: "ARTIFACT_ROOT_NOT_DIRECTORY", path: ".", detail: "deployment artifact root must be a directory" }],
      expectedArtifactSha256,
    });
    throw new DeploymentPrivacyError(receipt);
  }

  const files = await inventory(root, violations);
  const manifest = [];
  let bytesScanned = 0;
  for (const file of files) {
    if (!allowedStaticPath(file.relative) || FORBIDDEN_BASENAME.test(file.relative)) {
      violations.push({ code: "UNEXPECTED_STATIC_PATH", path: file.relative, detail: "path is outside the static deployment allowlist" });
    }
    if (PRIVATE_PATH.test(file.relative)) {
      violations.push({ code: "PRIVATE_RESEARCH_PATH", path: file.relative, detail: "private research or validation path" });
    }
    if (AUDIO_EXTENSION.test(file.relative)) {
      violations.push({ code: "AUDIO_PATH", path: file.relative, detail: "raw audio extension" });
    }

    let bytes;
    try {
      bytes = await readFile(file.absolute);
    } catch {
      violations.push({ code: "FILE_READ_FAILED", path: file.relative, detail: "regular file bytes could not be scanned" });
      continue;
    }
    bytesScanned += bytes.length;
    manifest.push({ path: file.relative, size_bytes: bytes.length, sha256: sha256(bytes) });
    if (audioMagic(bytes)) {
      violations.push({ code: "AUDIO_SIGNATURE", path: file.relative, detail: "audio container or codec signature" });
    } else if (TEXT_STATIC_EXTENSION.test(file.relative)) {
      const embeddedKind = embeddedAudioKind(bytes);
      if (embeddedKind) {
        violations.push({ code: "AUDIO_EMBEDDED_SIGNATURE", path: file.relative, detail: embeddedKind });
      }
    }
    const kinds = secretKinds(bytes);
    if (kinds.length) {
      violations.push({ code: "SECRET_MATERIAL", path: file.relative, detail: `credential signature(s): ${kinds.join(",")}` });
    }
  }

  if (expectedArtifactSha256 && !SHA256.test(expectedArtifactSha256)) {
    violations.push({ code: "EXPECTED_DIGEST_INVALID", path: ".", detail: "expected artifact digest is not lowercase SHA-256" });
  }

  const receipt = receiptFor({ manifest, bytesScanned, violations, expectedArtifactSha256 });
  if (expectedArtifactSha256 && receipt.artifact_sha256 !== expectedArtifactSha256) {
    receipt.violations.push({
      code: "ARTIFACT_DIGEST_MISMATCH",
      path_sha256: pathSha256("."),
      detail: "downloaded artifact bytes differ from the build-stage receipt",
    });
    receipt.violations.sort((left, right) => (
      left.path_sha256.localeCompare(right.path_sha256)
      || left.code.localeCompare(right.code)
      || left.detail.localeCompare(right.detail)
    ));
    receipt.status = "FAIL";
    receipt.manifest_paths_redacted = true;
    receipt.file_manifest = manifest.map(({ path: manifestPath, size_bytes: sizeBytes, sha256: fileSha256 }) => ({
      path_sha256: pathSha256(manifestPath),
      size_bytes: sizeBytes,
      sha256: fileSha256,
    }));
    receipt.checks.artifact_digest_matches_build_receipt = false;
  }
  if (receipt.status !== "PASS") throw new DeploymentPrivacyError(receipt);
  return receipt;
}

function argument(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : "";
}

async function main(argv = process.argv.slice(2)) {
  const rootArg = argv[0] || "";
  const output = argument(argv, "--output");
  const expectedReceiptPath = argument(argv, "--expected-receipt");
  if (!rootArg || rootArg.startsWith("--") || (argv.includes("--output") && !output) || (argv.includes("--expected-receipt") && !expectedReceiptPath)) {
    throw new Error("usage: node verify-deployment-privacy.mjs <artifact-directory> [--expected-receipt <path>] [--output <path>]");
  }

  let expectedArtifactSha256 = "";
  let expectedReceiptFailure = "";
  if (expectedReceiptPath) {
    try {
      const expectedReceipt = JSON.parse(await readFile(path.resolve(expectedReceiptPath), "utf8"));
      if (
        expectedReceipt.schema_version !== SCHEMA_VERSION
        || expectedReceipt.allowlist_revision !== ALLOWLIST_REVISION
        || expectedReceipt.status !== "PASS"
        || !SHA256.test(expectedReceipt.artifact_sha256 || "")
      ) {
        throw new Error("expected receipt is not a valid PASS receipt");
      }
      expectedArtifactSha256 = expectedReceipt.artifact_sha256;
    } catch (error) {
      expectedReceiptFailure = "expected receipt could not be read, parsed, or validated";
    }
  }

  let receipt;
  try {
    receipt = await verifyDeploymentPrivacy(path.resolve(rootArg), { expectedArtifactSha256 });
    if (expectedReceiptFailure) {
      receipt.violations.push({ code: "EXPECTED_RECEIPT_INVALID", path_sha256: pathSha256("."), detail: expectedReceiptFailure });
      receipt.violations.sort((left, right) => left.code.localeCompare(right.code));
      receipt.status = "FAIL";
      receipt.manifest_paths_redacted = true;
      receipt.file_manifest = receipt.file_manifest.map(({ path: manifestPath, size_bytes: sizeBytes, sha256: fileSha256 }) => ({
        path_sha256: pathSha256(manifestPath),
        size_bytes: sizeBytes,
        sha256: fileSha256,
      }));
    }
  } catch (error) {
    if (!error.receipt) throw error;
    receipt = error.receipt;
    if (expectedReceiptFailure) {
      receipt.violations.push({ code: "EXPECTED_RECEIPT_INVALID", path_sha256: pathSha256("."), detail: expectedReceiptFailure });
      receipt.violations.sort((left, right) => left.code.localeCompare(right.code));
      receipt.status = "FAIL";
    }
  }

  if (output) await writeFile(path.resolve(output), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  if (receipt.status !== "PASS") {
    process.stderr.write("deployment privacy verification failed; see structured receipt\n");
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write("deployment privacy verifier failed before producing a receipt\n");
    process.exitCode = 1;
  });
}
