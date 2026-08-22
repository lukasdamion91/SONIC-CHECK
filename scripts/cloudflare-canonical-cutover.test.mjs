import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalSpaRewriteRule,
  desiredEdgeSettings,
  desiredRecords,
  legacyRedirectRule,
  mergeCanonicalRedirects,
  mergeCanonicalRewrites,
  normalizeToken,
  validateState,
  wwwRedirectRule,
} from "./cloudflare-canonical-cutover.mjs";

const canonicalState = {
  schema_version: "soniccheck-cloudflare-cutover/1.0.0",
  phase: "canonical",
  canonical_origin: "https://soniccheck.io",
  legacy_origin: "https://app.soniccheck.io",
  api_origin: "https://api.soniccheck.io",
  paid_public_traffic_enabled: false,
};

test("normalizes only supported token wrappers", () => {
  assert.equal(normalizeToken('CLOUDFLARE_API_TOKEN="abc"'), "abc");
  assert.equal(normalizeToken("Bearer xyz"), "xyz");
});

test("canonical state cannot repoint the API or enable paid traffic", () => {
  assert.equal(validateState(canonicalState).phase, "canonical");
  assert.throws(() => validateState({ ...canonicalState, api_origin: "https://app.soniccheck.io" }));
  assert.throws(() => validateState({ ...canonicalState, paid_public_traffic_enabled: true }));
});

test("canonical phase proxies only the apex and www for deterministic edge routing", () => {
  const records = desiredRecords("canonical");
  assert.deepEqual(new Set(records.map(({ name }) => name)), new Set(["soniccheck.io", "www.soniccheck.io"]));
  assert.equal(records.filter(({ name }) => name === "soniccheck.io").length, 4);
  assert.ok(records.every(({ proxied }) => proxied === true));
  assert.deepEqual(records.find(({ name }) => name === "www.soniccheck.io"), {
    type: "A",
    name: "www.soniccheck.io",
    content: "192.0.2.1",
    ttl: 1,
    proxied: true,
    comment: "SONIC CHECK www host; Cloudflare redirect only",
  });
  const rule = wwwRedirectRule();
  assert.equal(rule.action_parameters.from_value.status_code, 301);
  assert.equal(
    rule.action_parameters.from_value.target_url.expression,
    'concat("https://soniccheck.io", http.request.uri.path)',
  );
  assert.equal(rule.action_parameters.from_value.preserve_query_string, true);
});

test("canonical SPA routes are internally rewritten to the deployed entry point", () => {
  const rule = canonicalSpaRewriteRule();
  assert.equal(rule.action, "rewrite");
  assert.equal(rule.action_parameters.uri.path.value, "/index.html");
  assert.match(rule.expression, /http\.host eq "soniccheck\.io"/);
  assert.match(rule.expression, /"\/login"/);
  assert.match(rule.expression, /"\/join"/);
  assert.match(rule.expression, /"\/app"/);
  assert.match(rule.expression, /starts_with\(http\.request\.uri\.path, "\/app\/"\)/);
});

test("cutover hardens HTTPS and rejects obsolete TLS at the Cloudflare edge", () => {
  assert.deepEqual(desiredEdgeSettings(), {
    always_use_https: "on",
    min_tls_version: "1.2",
  });
});

test("retirement adds a proxied documentation address and an exact permanent redirect", () => {
  const appRecord = desiredRecords("retire_legacy").find(({ name }) => name === "app.soniccheck.io");
  assert.deepEqual(appRecord, {
    type: "A",
    name: "app.soniccheck.io",
    content: "192.0.2.1",
    ttl: 1,
    proxied: true,
    comment: "SONIC CHECK retired legacy host; Cloudflare redirect only",
  });
  const rule = legacyRedirectRule();
  assert.equal(rule.action_parameters.from_value.status_code, 301);
  assert.equal(rule.action_parameters.from_value.target_url.value, "https://soniccheck.io/app");
  assert.equal(rule.action_parameters.from_value.preserve_query_string, true);
});

test("redirect merge preserves unrelated rules and remains phase-idempotent", () => {
  const unrelated = {
    id: "read-only-id",
    version: "7",
    last_updated: "2026-08-21T00:00:00Z",
    ref: "unrelated",
    action: "redirect",
    expression: '(http.host eq "old.example")',
    action_parameters: { from_value: { target_url: { value: "https://example.com" }, status_code: 302 } },
    enabled: true,
  };
  const canonical = mergeCanonicalRedirects([unrelated], "canonical");
  assert.equal(canonical.length, 2);
  assert.equal(canonical.filter(({ ref }) => ref === "soniccheck_redirect_www_canonical").length, 1);
  assert.equal(canonical.filter(({ ref }) => ref === "soniccheck_redirect_app_legacy").length, 0);
  const once = mergeCanonicalRedirects(canonical, "retire_legacy");
  const twice = mergeCanonicalRedirects(once, "retire_legacy");
  assert.equal(twice.length, 3);
  assert.equal(twice.filter(({ ref }) => ref === "soniccheck_redirect_app_legacy").length, 1);
  assert.equal(twice.filter(({ ref }) => ref === "soniccheck_redirect_www_canonical").length, 1);
  assert.equal(twice[0].ref, "unrelated");
  assert.equal("id" in twice[0], false);
  assert.equal("version" in twice[0], false);
  assert.equal("last_updated" in twice[0], false);
});

test("rewrite merge preserves unrelated transforms and is idempotent", () => {
  const unrelated = {
    id: "read-only-id",
    version: "3",
    last_updated: "2026-08-21T00:00:00Z",
    ref: "unrelated_transform",
    action: "rewrite",
    expression: '(http.host eq "assets.example")',
    action_parameters: { uri: { path: { value: "/assets" } } },
    enabled: true,
  };
  const once = mergeCanonicalRewrites([unrelated]);
  const twice = mergeCanonicalRewrites(once);
  assert.equal(twice.length, 2);
  assert.equal(twice.filter(({ ref }) => ref === "soniccheck_rewrite_canonical_spa").length, 1);
  assert.equal(twice[0].ref, "unrelated_transform");
  assert.equal("id" in twice[0], false);
  assert.equal("version" in twice[0], false);
  assert.equal("last_updated" in twice[0], false);
});
