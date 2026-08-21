import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { verifyPagesBuild } from "./verify-pages-build.mjs";


const routes = ["/", "/login", "/join", "/app", "/app/billing", "/app/scan/new", "/app/library"];

function fixture({ fallback = null, auth = "true" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "soniccheck-pages-v17-"));
  mkdirSync(join(root, "build", "static", "js"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  const commit = "a".repeat(40);
  const html = [
    `<meta name="soniccheck-deployment-commit" content="${commit}" />`,
    '<meta name="soniccheck-product-contract" content="SC-PRODUCT/2026.08.20.1" />',
    `<meta name="soniccheck-auth-configured" content="${auth}" />`,
  ].join("");
  writeFileSync(join(root, "build", "index.html"), html);
  writeFileSync(join(root, "build", "404.html"), fallback ?? html);
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

test("production verification fails closed when Clerk is not configured", () => {
  const { root, commit } = fixture({ auth: "false" });

  const result = verifyPagesBuild({ root, expectedCommit: commit, requireAuth: true });

  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("AUTH_NOT_CONFIGURED"));
});
