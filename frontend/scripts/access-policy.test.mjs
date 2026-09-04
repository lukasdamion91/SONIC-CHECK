import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { canStartScan, resolveAccessPolicy } from "../src/lib/accessPolicy.mjs";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("API scan capability overrides stale legacy plan and credit fields", () => {
  const denied = {
    role: "admin",
    plan: "pro_monthly",
    scan_credits: 9,
    access_policy: {
      can_scan: false,
      scan_remaining: 0,
      scan_denial_reason: "monthly_quota_reached",
      can_view_owned_records: true,
    },
  };

  assert.equal(canStartScan(denied), false);
  assert.deepEqual(
    {
      can_scan: resolveAccessPolicy(denied).can_scan,
      scan_remaining: resolveAccessPolicy(denied).scan_remaining,
      scan_denial_reason: resolveAccessPolicy(denied).scan_denial_reason,
      can_view_owned_records: resolveAccessPolicy(denied).can_view_owned_records,
    },
    {
      can_scan: false,
      scan_remaining: 0,
      scan_denial_reason: "monthly_quota_reached",
      can_view_owned_records: true,
    },
  );

  assert.equal(canStartScan({ access_policy: { can_scan: true } }), true);
});

test("normalised policy exposes report, badge and retention capabilities", () => {
  const policy = resolveAccessPolicy({
    access_policy: {
      can_scan: false,
      scan_remaining: 0,
      can_view_owned_records: true,
      can_download_report: true,
      report_remaining: 1,
      report_credit_will_be_consumed: true,
      can_create_badge: false,
      can_retain_audio: false,
    },
  });

  assert.equal(policy.can_view_owned_records, true);
  assert.equal(policy.can_download_report, true);
  assert.equal(policy.report_remaining, 1);
  assert.equal(policy.report_credit_will_be_consumed, true);
  assert.equal(policy.can_create_badge, false);
  assert.equal(policy.can_retain_audio, false);
});

test("legacy account payloads retain the previous scan fallback", () => {
  assert.equal(canStartScan({ scan_credits: 1 }), true);
  assert.equal(canStartScan({ scan_credits: 0 }), false);
  assert.equal(canStartScan({ plan: "pro_annual" }), true);
});

test("legacy unrestricted aliases independently restore the full fallback", () => {
  for (const alias of ["unrestricted", "full_product_access", "unmetered"]) {
    const policy = resolveAccessPolicy({ access_policy: { [alias]: true } });
    assert.equal(policy.can_scan, true, alias);
    assert.equal(policy.scan_remaining, null, alias);
    assert.equal(policy.can_download_report, true, alias);
    assert.equal(policy.report_remaining, null, alias);
    assert.equal(policy.report_credit_will_be_consumed, false, alias);
    assert.equal(policy.can_create_badge, true, alias);
    assert.equal(policy.can_retain_audio, true, alias);
  }
});

test("legacy reports alias restores download access but never public badge access", () => {
  const policy = resolveAccessPolicy({ access_policy: { reports: true } });

  assert.equal(policy.can_scan, false);
  assert.equal(policy.can_download_report, true);
  assert.equal(policy.report_remaining, null);
  assert.equal(policy.report_credit_will_be_consumed, false);
  assert.equal(policy.can_create_badge, false);

  const credited = resolveAccessPolicy({
    report_credits: 1,
    access_policy: { reports: true },
  });
  assert.equal(credited.report_remaining, 1);
  assert.equal(credited.report_credit_will_be_consumed, true);
  assert.equal(credited.can_create_badge, false);
});

test("legacy false aliases do not cancel independent plan or credit grants", () => {
  const credited = resolveAccessPolicy({
    report_credits: 1,
    access_policy: { reports: false },
  });
  assert.equal(credited.can_download_report, true);
  assert.equal(credited.report_remaining, 1);
  assert.equal(credited.report_credit_will_be_consumed, true);
  assert.equal(credited.can_create_badge, false);

  const subscribed = resolveAccessPolicy({
    plan: "pro_monthly",
    access_policy: {
      unrestricted: false,
      full_product_access: false,
      unmetered: false,
      reports: false,
    },
  });
  assert.equal(subscribed.can_scan, true);
  assert.equal(subscribed.can_download_report, true);
  assert.equal(subscribed.can_create_badge, true);
});

test("modern capability booleans override permissive legacy aliases", () => {
  const denied = resolveAccessPolicy({
    access_policy: {
      unrestricted: true,
      full_product_access: true,
      unmetered: true,
      reports: true,
      can_scan: false,
      scan_remaining: 0,
      can_download_report: false,
      report_remaining: 0,
      report_credit_will_be_consumed: false,
      can_create_badge: false,
      can_retain_audio: false,
      private_audio_retention: true,
    },
  });

  assert.equal(denied.can_scan, false);
  assert.equal(denied.scan_remaining, 0);
  assert.equal(denied.can_download_report, false);
  assert.equal(denied.report_remaining, 0);
  assert.equal(denied.report_credit_will_be_consumed, false);
  assert.equal(denied.can_create_badge, false);
  assert.equal(denied.can_retain_audio, false);

  const allowed = resolveAccessPolicy({
    access_policy: {
      unrestricted: false,
      reports: false,
      can_scan: true,
      can_download_report: true,
      can_create_badge: true,
      can_retain_audio: true,
    },
  });
  assert.equal(allowed.can_scan, true);
  assert.equal(allowed.can_download_report, true);
  assert.equal(allowed.can_create_badge, true);
  assert.equal(allowed.can_retain_audio, true);
});

test("only new-record routes use the scan entitlement gate", async () => {
  const [app, dashboard, library, scanResult, authContext] = await Promise.all([
    source("../src/App.js"),
    source("../src/pages/Dashboard.jsx"),
    source("../src/pages/Library.jsx"),
    source("../src/pages/ScanResult.jsx"),
    source("../src/context/AuthContext.jsx"),
  ]);

  assert.match(app, /path="\/app\/scan\/new" element=\{<Entitled><NewScan \/><\/Entitled>\}/);
  assert.match(app, /path="\/app\/scans\/:id" element=\{<Protected><ScanResult \/><\/Protected>\}/);
  assert.match(app, /path="\/app\/library" element=\{<Protected><Library \/><\/Protected>\}/);
  assert.doesNotMatch(app, /path="\/app\/(?:scans\/:id|library)" element=\{<Entitled>/);

  assert.match(dashboard, /<Link to="\/app\/library"/);
  assert.doesNotMatch(dashboard, /\{entitled && <Link to="\/app\/library"/);
  assert.match(dashboard, /return <Link key=\{scan\.id\} to=\{`\/app\/scans\/\$\{scan\.id\}`\}/);
  assert.match(library, /disabled=\{Boolean\(action\) \|\| !canScan\}/);
  assert.match(library, /const \{ user, refresh \} = useAuth\(\)/);
  assert.match(library, /await refresh\(\);[\s\S]*navigate\(`/);
  assert.match(library, /accessPolicy\.can_retain_audio/);
  assert.match(scanResult, /accessPolicy\.can_download_report/);
  assert.match(scanResult, /accessPolicy\.report_credit_will_be_consumed/);
  assert.match(scanResult, /accessPolicy\.can_create_badge/);
  assert.match(authContext, /return canStartScan\(user\)/);
});
