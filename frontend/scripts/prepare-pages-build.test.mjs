import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { preparePagesBuild } from "./prepare-pages-build.mjs";

const entry = `<!doctype html><html><head>
<meta name="description" content="Home description" />
<meta name="soniccheck-deployment-commit" content="${"a".repeat(40)}" />
<meta name="soniccheck-product-contract" content="SC-PRODUCT/2026.08.20.1" />
<meta name="soniccheck-auth-configured" content="true" />
<link rel="canonical" href="https://soniccheck.io/" />
<title>SONIC CHECK — Originality Evidence Screening</title>
</head><body><div id="root"></div><script src="/static/js/main.js"></script></body></html>`;

function rootWithIndex(html = entry) {
  const root = mkdtempSync(join(tmpdir(), "soniccheck-policy-entry-"));
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(join(root, "build", "index.html"), html);
  return root;
}

test("prepares fallback plus route-canonical customer policy entries", () => {
  const root = rootWithIndex();

  preparePagesBuild({ root });

  const fallback = readFileSync(join(root, "build", "404.html"), "utf8");
  const privacy = readFileSync(join(root, "build", "privacy", "index.html"), "utf8");
  const terms = readFileSync(join(root, "build", "terms", "index.html"), "utf8");
  assert.equal(fallback, entry);
  assert.match(privacy, /href="https:\/\/soniccheck\.io\/privacy\/"/);
  assert.match(privacy, /<title>Privacy Policy — SONIC CHECK<\/title>/);
  assert.match(privacy, /soniccheck-deployment-commit/);
  assert.match(privacy, /soniccheck-product-contract/);
  assert.match(terms, /href="https:\/\/soniccheck\.io\/terms\/"/);
  assert.match(terms, /<title>Terms of Use — SONIC CHECK<\/title>/);
  assert.match(terms, /soniccheck-auth-configured/);
  assert.match(terms, /soniccheck-product-contract/);
});

test("fails closed without a source entry or exact canonical marker", () => {
  const missingRoot = mkdtempSync(join(tmpdir(), "soniccheck-policy-missing-"));
  assert.equal(existsSync(join(missingRoot, "build", "index.html")), false);
  assert.throws(() => preparePagesBuild({ root: missingRoot }), /before build\/index\.html exists/);

  const badCanonicalRoot = rootWithIndex(entry.replace("https://soniccheck.io/", "https://wrong.example/"));
  assert.throws(() => preparePagesBuild({ root: badCanonicalRoot }), /canonical homepage marker/);
});
