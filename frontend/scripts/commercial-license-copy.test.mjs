import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  commercialLicenseState,
  FORMAL_LICENCE_REQUIRED,
} from "../src/lib/productContract.mjs";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("commercial licensing and paid traffic fail closed independently", () => {
  const unavailable = commercialLicenseState(null);
  assert.equal(unavailable.checkoutOpen, false);
  assert.equal(unavailable.label, "Commercial licence status unavailable");

  const licenceRequired = commercialLicenseState({
    paid_public_scanning: "enabled",
    commercial_license_gate: {
      status: FORMAL_LICENCE_REQUIRED,
      approved: false,
      paid_traffic_authorized: true,
    },
  });
  assert.equal(licenceRequired.checkoutOpen, false);
  assert.equal(licenceRequired.label, "Formal commercial licence required");

  const paidTrafficClosed = commercialLicenseState({
    paid_public_scanning: "closed",
    commercial_license_gate: {
      status: "approved",
      approved: true,
      paid_traffic_authorized: false,
    },
  });
  assert.equal(paidTrafficClosed.checkoutOpen, false);
  assert.equal(paidTrafficClosed.label, "Paid checkout separately closed");

  assert.equal(commercialLicenseState({
    paid_public_scanning: "enabled",
    commercial_license_gate: {
      status: "approved",
      approved: true,
      paid_traffic_authorized: true,
    },
  }).checkoutOpen, true);
});

test("checkout opens only when every commercial gate is exactly satisfied", () => {
  for (const status of [FORMAL_LICENCE_REQUIRED, "approved"]) {
    for (const approved of [false, true]) {
      for (const paidTrafficAuthorized of [false, true]) {
        for (const paidPublicScanning of ["closed", "enabled"]) {
          const state = commercialLicenseState({
            paid_public_scanning: paidPublicScanning,
            commercial_license_gate: {
              status,
              approved,
              paid_traffic_authorized: paidTrafficAuthorized,
            },
          });
          const expected = status === "approved"
            && approved
            && paidTrafficAuthorized
            && paidPublicScanning === "enabled";
          assert.equal(
            state.checkoutOpen,
            expected,
            JSON.stringify({ status, approved, paidTrafficAuthorized, paidPublicScanning }),
          );
        }
      }
    }
  }
});

test("public and account pages surface the API commercial-licence gate", async () => {
  const [app, landing, pricing, register, notice, productContract, claimsValidator] = await Promise.all([
    source("../src/App.js"),
    source("../src/pages/Landing.jsx"),
    source("../src/pages/Pricing.jsx"),
    source("../src/pages/Register.jsx"),
    source("../src/components/CommercialLicenseNotice.jsx"),
    source("../src/lib/productContract.mjs"),
    source("./validate-public-claims.mjs"),
  ]);

  for (const page of [landing, pricing, register]) {
    assert.match(page, /<CommercialLicenseNotice contract=\{contract\}/);
  }
  assert.match(landing, /api\.get\("\/product-contract"\)/);
  assert.match(pricing, /api\.get\("\/product-contract"\)/);
  assert.match(pricing, /nextContract\?\.pricing\?\.plans/);
  assert.match(pricing, /licenseState\.checkoutOpen && plans\.some/);
  assert.match(pricing, /api\.post\("\/checkout\/portal"/);
  assert.match(pricing, /disabled=\{!checkoutOpen \|\| !plan\.checkout_enabled\}/);
  assert.match(pricing, /!checkoutOpen \? "Paid checkout closed" : plan\.sales_only/);
  assert.match(register, /api\.get\("\/product-contract"\)/);
  assert.match(notice, /data-license-status=\{state\.status\}/);
  assert.match(app, /path="\/app\/payment-success" element=\{<Protected><PaymentSuccess \/><\/Protected>\}/);
  assert.match(claimsValidator, /src\/components\/CommercialLicenseNotice\.jsx/);
  assert.match(claimsValidator, /src\/lib\/productContract\.mjs/);

  const misleading = [
    /Create an account to purchase or manage an entitlement/,
    /select an AUD plan, receive an entitlement/,
    /closed until the operational readiness gate is green/,
    /RC-0 provider, identity, catalogue and billing readiness/,
  ];
  for (const phrase of misleading) {
    assert.doesNotMatch(`${landing}\n${pricing}\n${register}\n${notice}\n${productContract}`, phrase);
  }
});
