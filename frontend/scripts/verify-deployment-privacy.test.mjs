import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { verifyDeploymentPrivacy } from "./verify-deployment-privacy.mjs";

const execFileAsync = promisify(execFile);
const script = new URL("./verify-deployment-privacy.mjs", import.meta.url);

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), "soniccheck-artifact-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function failureReceipt(promise) {
  try {
    await promise;
    assert.fail("expected deployment privacy verification to fail");
  } catch (error) {
    assert.equal(error.name, "DeploymentPrivacyError");
    assert.equal(error.receipt.status, "FAIL");
    return error.receipt;
  }
}

test("deployment privacy verifier produces a deterministic byte manifest for a normal static artifact", async () => {
  await fixture(async (root) => {
    await mkdir(path.join(root, "static", "js"), { recursive: true });
    await writeFile(path.join(root, "index.html"), "<title>SONIC CHECK</title>");
    await writeFile(path.join(root, "static", "js", "app.js"), "const analyzer = 'HARRY_V36';");
    const first = await verifyDeploymentPrivacy(root);
    const second = await verifyDeploymentPrivacy(root);
    assert.equal(first.status, "PASS");
    assert.equal(first.files_scanned, 2);
    assert.equal(first.bytes_scanned, 55);
    assert.match(first.artifact_sha256, /^[a-f0-9]{64}$/u);
    assert.equal(first.artifact_sha256, second.artifact_sha256);
    assert.deepEqual(first.file_manifest, second.file_manifest);
    assert.deepEqual(first.file_manifest.map((entry) => entry.path), ["index.html", "static/js/app.js"]);
    assert.equal(first.manifest_paths_redacted, false);
    assert.equal(first.private_research_evidence_present, false);
    assert.equal(first.checks.all_regular_file_bytes_scanned, true);
  });
});

test("deployment privacy verifier rejects paths outside the static artifact allowlist after scanning their bytes", async () => {
  await fixture(async (root) => {
    const payload = "private finding";
    await mkdir(path.join(root, "research"));
    await writeFile(path.join(root, "research", "receipt.json"), payload);
    const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
    assert.equal(receipt.bytes_scanned, Buffer.byteLength(payload));
    assert.equal(receipt.private_research_evidence_present, true);
    assert.ok(receipt.violations.some(({ code }) => code === "UNEXPECTED_STATIC_PATH"));
    assert.ok(receipt.violations.some(({ code }) => code === "PRIVATE_RESEARCH_PATH"));
    assert.equal(receipt.manifest_paths_redacted, true);
    assert.equal(JSON.stringify(receipt).includes("research/receipt.json"), false);
    assert.ok(receipt.file_manifest.every((entry) => !Object.hasOwn(entry, "path") && /^[a-f0-9]{64}$/u.test(entry.path_sha256)));
  });
});

test("deployment privacy verifier rejects source maps without disclosing their filename", async () => {
  await fixture(async (root) => {
    const sourceMapName = "private-analyzer.js.map";
    await mkdir(path.join(root, "static", "js"), { recursive: true });
    await writeFile(path.join(root, "static", "js", sourceMapName), "{\"version\":3}");
    const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
    assert.ok(receipt.violations.some(({ code }) => code === "UNEXPECTED_STATIC_PATH"));
    assert.equal(JSON.stringify(receipt).includes(sourceMapName), false);
  });
});

test("deployment privacy verifier rejects audio extensions and disguised audio signatures", async () => {
  await fixture(async (root) => {
    await writeFile(path.join(root, "private.wav"), "not-even-audio");
    const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
    assert.equal(receipt.raw_audio_present, true);
    assert.ok(receipt.violations.some(({ code }) => code === "AUDIO_PATH"));
  });
  await fixture(async (root) => {
    await mkdir(path.join(root, "static", "js"), { recursive: true });
    await writeFile(path.join(root, "static", "js", "app.js"), Buffer.from("RIFF0000WAVEfmt ", "ascii"));
    const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
    assert.ok(receipt.violations.some(({ code }) => code === "AUDIO_SIGNATURE"));
  });
});

test("deployment privacy verifier rejects audio embedded or encoded in static bundles", async () => {
  const cases = [
    Buffer.from('const sample = "data:audio/wav;base64,AAAA";', "ascii"),
    Buffer.from(`const sample = "${Buffer.from("RIFF0000WAVEfmt ", "ascii").toString("base64")}";`, "ascii"),
    Buffer.concat([
      Buffer.from("const wrapped = `prefix-", "ascii"),
      Buffer.from("RIFF0000WAVEfmt ", "ascii"),
      Buffer.from("`;", "ascii"),
    ]),
  ];
  for (const payload of cases) {
    await fixture(async (root) => {
      await mkdir(path.join(root, "static", "js"), { recursive: true });
      await writeFile(path.join(root, "static", "js", "app.js"), payload);
      const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
      assert.equal(receipt.raw_audio_present, true);
      assert.ok(receipt.violations.some(({ code }) => code === "AUDIO_EMBEDDED_SIGNATURE"));
      assert.equal(receipt.semantic_content_classification_claimed, false);
    });
  }
});

test("deployment privacy verifier does not relabel ordinary encoded text as audio", async () => {
  await fixture(async (root) => {
    await mkdir(path.join(root, "static", "js"), { recursive: true });
    await writeFile(
      path.join(root, "static", "js", "app.js"),
      `const note = "${Buffer.from("SONIC CHECK HARRY_V36", "ascii").toString("base64")}";`,
    );
    const receipt = await verifyDeploymentPrivacy(root);
    assert.equal(receipt.status, "PASS");
    assert.equal(receipt.raw_audio_present, false);
    assert.equal(
      receipt.content_classification_scope,
      "EXACT_STATIC_PATH_ALLOWLIST_AND_RECOGNIZED_BYTE_OR_ENCODING_SIGNATURES",
    );
    assert.equal(receipt.semantic_content_classification_claimed, false);
  });
});

test("deployment privacy verifier scans an entire large file and rejects broad secret signatures", async () => {
  await fixture(async (root) => {
    await mkdir(path.join(root, "static", "js"), { recursive: true });
    const prefix = Buffer.alloc(2 * 1024 * 1024, 0x20);
    const secret = Buffer.from("const client_secret='not-a-real-secret-but-long-enough-12345';", "ascii");
    const payload = Buffer.concat([prefix, secret]);
    await writeFile(path.join(root, "static", "js", "main.js"), payload);
    const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
    assert.equal(receipt.bytes_scanned, payload.length);
    assert.equal(receipt.secret_material_present, true);
    assert.ok(receipt.violations.some(({ code, detail }) => code === "SECRET_MATERIAL" && detail.includes("assigned-secret")));
  });
  await fixture(async (root) => {
    await mkdir(path.join(root, "static", "js"), { recursive: true });
    await writeFile(path.join(root, "static", "js", "main.js"), "ACR_ACCESS_SECRET=abcdefghijklmnopqrstuv");
    const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
    assert.ok(receipt.violations.some(({ code, detail }) => code === "SECRET_MATERIAL" && detail.includes("acr-credential")));
  });
});

test("deployment privacy verifier rejects symbolic links", async () => {
  await fixture(async (root) => {
    await writeFile(path.join(root, "index.html"), "safe");
    await symlink("index.html", path.join(root, "linked.html"));
    const receipt = await failureReceipt(verifyDeploymentPrivacy(root));
    assert.equal(receipt.checks.no_symbolic_or_special_files, false);
    assert.ok(receipt.violations.some(({ code }) => code === "SYMBOLIC_LINK"));
  });
});

test("deployment privacy verifier binds deploy bytes to the build-stage digest", async () => {
  await fixture(async (root) => {
    await writeFile(path.join(root, "index.html"), "first");
    const buildReceipt = await verifyDeploymentPrivacy(root);
    const sameBytes = await verifyDeploymentPrivacy(root, { expectedArtifactSha256: buildReceipt.artifact_sha256 });
    assert.equal(sameBytes.checks.artifact_digest_matches_build_receipt, true);

    await writeFile(path.join(root, "index.html"), "mutated");
    const receipt = await failureReceipt(
      verifyDeploymentPrivacy(root, { expectedArtifactSha256: buildReceipt.artifact_sha256 }),
    );
    assert.equal(receipt.checks.artifact_digest_matches_build_receipt, false);
    assert.ok(receipt.violations.some(({ code }) => code === "ARTIFACT_DIGEST_MISMATCH"));
  });
});

test("CLI writes a structured FAIL receipt even when verification fails", async () => {
  await fixture(async (root) => {
    const output = path.join(root, "..", `${path.basename(root)}-failure.json`);
    await writeFile(path.join(root, "leaked.mp3"), "forbidden");
    const failure = await execFileAsync(process.execPath, [script.pathname, root, "--output", output])
      .then(() => null, (error) => error);
    assert.ok(failure);
    const receipt = JSON.parse(await readFile(output, "utf8"));
    assert.equal(receipt.status, "FAIL");
    assert.ok(receipt.violations.some(({ code }) => code === "AUDIO_PATH"));
    assert.equal(JSON.stringify(receipt).includes("leaked.mp3"), false);
    assert.equal(failure.stdout.includes("leaked.mp3"), false);
    assert.equal(failure.stderr.includes("leaked.mp3"), false);
    await rm(output, { force: true });
  });
});

test("production deploy and verification are restricted to the main branch ref", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/static.yml", import.meta.url), "utf8");
  const productionRefGate = "if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'";
  assert.equal(workflow.split(productionRefGate).length - 1, 2);
  assert.match(workflow, /\n  deploy:\n    if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /\n  verify-production:\n    if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/u);
});
