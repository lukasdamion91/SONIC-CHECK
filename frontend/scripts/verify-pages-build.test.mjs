import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { verifyPagesBuild } from "./verify-pages-build.mjs";


const routes = [
  "/", "/login", "/join", "/privacy", "/terms", "/app",
  "/app/billing", "/app/scan/new", "/app/library",
];

function fixture({
  fallback = null,
  privacy = null,
  terms = null,
  auth = "true",
  policyProductContract = "SC-PRODUCT/2026.08.20.1",
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "soniccheck-pages-v17-"));
  mkdirSync(join(root, "build", "static", "js"), { recursive: true });
  mkdirSync(join(root, "build", "privacy"), { recursive: true });
  mkdirSync(join(root, "build", "terms"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  const commit = "a".repeat(40);
  const html = [
    '<meta name="description" content="Home description" />',
    `<meta name="soniccheck-deployment-commit" content="${commit}" />`,
    '<meta name="soniccheck-product-contract" content="SC-PRODUCT/2026.08.20.1" />',
    `<meta name="soniccheck-auth-configured" content="${auth}" />`,
    '<link rel="canonical" href="https://soniccheck.io/" />',
    '<title>SONIC CHECK — Originality Evidence Screening</title>',
  ].join("");
  const privacyEntry = html
    .replace("https://soniccheck.io/", "https://soniccheck.io/privacy/")
    .replace("SC-PRODUCT/2026.08.20.1", policyProductContract)
    .replace("SONIC CHECK — Originality Evidence Screening", "Privacy Policy — SONIC CHECK");
  const termsEntry = html
    .replace("https://soniccheck.io/", "https://soniccheck.io/terms/")
    .replace("SC-PRODUCT/2026.08.20.1", policyProductContract)
    .replace("SONIC CHECK — Originality Evidence Screening", "Terms of Use — SONIC CHECK");
  writeFileSync(join(root, "build", "index.html"), html);
  writeFileSync(join(root, "build", "404.html"), fallback ?? html);
  writeFileSync(join(root, "build", "privacy", "index.html"), privacy ?? privacyEntry);
  writeFileSync(join(root, "build", "terms", "index.html"), terms ?? termsEntry);
  writeFileSync(join(root, "build", "CNAME"), "soniccheck.io\n");
  writeFileSync(join(root, "build", "asset-manifest.json"), '{"files":{}}\n');
  writeFileSync(
    join(root, "src", "App.js"),
    routes.map((route) => `<Route path="${route}" />`).join("\n"),
  );
  return { root, commit };
}

test("verified Pages artifact binds routes, fallback, domain and commit", () => {
  const { root, commit } = fixture();

  const result = verifyPagesBuild({ root, expectedCommit: commit });

  assert.equal(result.ok, true);
  assert.equal(result.artifact.fallback_byte_identical, true);
  assert.equal(result.artifact.policy_entries_canonical, true);
  assert.equal(result.artifact.cname, "soniccheck.io");
  assert.equal(result.readiness.auth_configured, true);
});

test("stale fallback or unresolved auth marker fails the artifact", () => {
  const { root, commit } = fixture({ fallback: "old build", auth: "%REACT_APP_CLERK_CONFIGURED%" });

  const result = verifyPagesBuild({ root, expectedCommit: commit });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("SPA_FALLBACK_NOT_BYTE_IDENTICAL"));
  assert.ok(result.failures.includes("AUTH_CONFIGURATION_MARKER_INVALID"));
});

test("stale customer policy entry points fail the artifact", () => {
  const { root, commit } = fixture({ privacy: "old privacy", terms: "old terms" });

  const result = verifyPagesBuild({ root, expectedCommit: commit });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("PRIVACY_ENTRY_INVALID"));
  assert.ok(result.failures.includes("TERMS_ENTRY_INVALID"));
});

test("policy entries must carry the same product contract as the deployed app", () => {
  const { root, commit } = fixture({ policyProductContract: "SC-PRODUCT/stale" });

  const result = verifyPagesBuild({ root, expectedCommit: commit });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("PRIVACY_ENTRY_INVALID"));
  assert.ok(result.failures.includes("TERMS_ENTRY_INVALID"));
});

test("production verification fails closed when Clerk is not configured", () => {
  const { root, commit } = fixture({ auth: "false" });

  const result = verifyPagesBuild({ root, expectedCommit: commit, requireAuth: true });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("AUTH_NOT_CONFIGURED"));
});
