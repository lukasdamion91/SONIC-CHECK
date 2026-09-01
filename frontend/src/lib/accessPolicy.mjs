const SUBSCRIPTION_PLANS = new Set([
  "pro_monthly",
  "pro_annual",
  "enterprise_annual",
]);

const nonNegativeInteger = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

const explicitBoolean = (value, fallback) => (
  typeof value === "boolean" ? value : fallback
);

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const hasLegacyUnmeteredAccess = (user) => Boolean(
  user?.role === "admin" || SUBSCRIPTION_PLANS.has(user?.plan),
);

const hasLegacyUnrestrictedAlias = (policy) => [
  policy.unrestricted,
  policy.full_product_access,
  policy.unmetered,
].some((value) => value === true);

/**
 * Normalise the API-owned access-policy projection for the UI.
 *
 * The fallback preserves compatibility with older API responses. An explicit
 * API boolean always wins, including `false` for an account that still carries
 * stale-looking legacy plan or credit fields.
 */
export function resolveAccessPolicy(user) {
  if (!user) {
    return {
      can_scan: false,
      scan_remaining: 0,
      scan_denial_reason: "authentication_required",
      can_view_owned_records: false,
      can_download_report: false,
      report_remaining: 0,
      report_credit_will_be_consumed: false,
      can_create_badge: false,
      can_retain_audio: false,
    };
  }

  const policy = user.access_policy && typeof user.access_policy === "object"
    ? user.access_policy
    : {};
  const legacyUnmetered = hasLegacyUnmeteredAccess(user)
    || hasLegacyUnrestrictedAlias(policy);
  const legacyReportAlias = policy.reports === true;
  const legacyReports = legacyUnmetered || legacyReportAlias;
  const legacyScanRemaining = legacyUnmetered ? null : nonNegativeInteger(user.scan_credits);
  const canScan = explicitBoolean(
    policy.can_scan,
    legacyUnmetered || legacyScanRemaining > 0,
  );
  const scanRemaining = hasOwn(policy, "scan_remaining")
    ? policy.scan_remaining
    : legacyScanRemaining;

  const storedReportRemaining = nonNegativeInteger(user.report_credits);
  const legacyReportRemaining = legacyUnmetered
    ? null
    : (storedReportRemaining > 0 ? storedReportRemaining : (legacyReportAlias ? null : 0));
  const canDownloadReport = explicitBoolean(
    policy.can_download_report,
    legacyUnmetered || legacyReports || legacyReportRemaining > 0,
  );
  const reportRemaining = hasOwn(policy, "report_remaining")
    ? policy.report_remaining
    : legacyReportRemaining;

  return {
    can_scan: canScan,
    scan_remaining: scanRemaining == null ? null : nonNegativeInteger(scanRemaining),
    scan_denial_reason: canScan
      ? null
      : (typeof policy.scan_denial_reason === "string" && policy.scan_denial_reason
        ? policy.scan_denial_reason
        : "paid_entitlement_required"),
    can_view_owned_records: explicitBoolean(policy.can_view_owned_records, true),
    can_download_report: canDownloadReport,
    report_remaining: reportRemaining == null ? null : nonNegativeInteger(reportRemaining),
    report_credit_will_be_consumed: explicitBoolean(
      policy.report_credit_will_be_consumed,
      canDownloadReport && !legacyUnmetered && storedReportRemaining > 0,
    ),
    // The historical `reports` alias grants report download only. Badge
    // publication is a separate public-data capability and must never be
    // inferred from a one-time report credit.
    can_create_badge: explicitBoolean(policy.can_create_badge, legacyUnmetered),
    can_retain_audio: explicitBoolean(
      policy.can_retain_audio,
      explicitBoolean(policy.private_audio_retention, legacyUnmetered),
    ),
  };
}

export function canStartScan(user) {
  return resolveAccessPolicy(user).can_scan;
}

export function scanDenialCopy(reason) {
  if (reason === "monthly_quota_reached") {
    return "This account has reached its current monthly screening allocation.";
  }
  if (reason === "authentication_required") {
    return "Sign in before starting a new evidence screen.";
  }
  return "This account does not currently have an available screening entitlement.";
}
