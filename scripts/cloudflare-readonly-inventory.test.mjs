import assert from "node:assert/strict";
import {
  constants as cryptoConstants,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import test from "node:test";

import {
  collectInventory,
  encryptInventory,
  normalizeToken,
  safeSummary,
} from "./cloudflare-readonly-inventory.mjs";

function response(result) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ success: true, errors: [], messages: [], result });
    },
  };
}

test("inventory uses GET only and never serializes the token", async () => {
  const calls = [];
  const token = "test-secret-token";
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/zones?")) {
      return response([{ id: "zone-id", name: "soniccheck.io", account: { id: "account-id" } }]);
    }
    if (url.endsWith("/rulesets")) {
      return response([{ id: "ruleset-id", phase: "http_request_dynamic_redirect" }]);
    }
    if (url.endsWith("/rulesets/ruleset-id")) {
      return response({ id: "ruleset-id", rules: [] });
    }
    return response([]);
  };

  const report = await collectInventory(token, {
    apiRoot: "https://example.invalid/client/v4",
    fetchImpl,
    signal: {},
  });

  assert.ok(calls.length >= 10);
  assert.ok(calls.every(({ options }) => options.method === "GET"));
  assert.ok(calls.every(({ options }) => !("body" in options)));
  assert.equal(JSON.stringify(report).includes(token), false);
  assert.equal(report.meta.mode, "read-only");
  assert.equal(safeSummary(report).zone_found, true);
});

test("encrypted inventory decrypts to the original report", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const report = { meta: { domain: "soniccheck.io", mode: "read-only" }, endpoints: {} };
  const envelope = encryptInventory(report, publicKey);

  const dataKey = privateDecrypt(
    {
      key: privateKey,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(envelope.encrypted_key, "base64"),
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    dataKey,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.auth_tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);

  assert.deepEqual(JSON.parse(plaintext.toString("utf8")), report);
});

test("token paste artefacts are removed without changing the token", () => {
  const token = "cfat_example123";
  assert.equal(normalizeToken(`  ${token}\r\n`), token);
  assert.equal(normalizeToken(`Bearer ${token}`), token);
  assert.equal(normalizeToken(`CLOUDFLARE_READ_TOKEN=${token}`), token);
  assert.equal(normalizeToken(`"${token}"`), token);
  assert.equal(normalizeToken(`'${token}'`), token);
});
