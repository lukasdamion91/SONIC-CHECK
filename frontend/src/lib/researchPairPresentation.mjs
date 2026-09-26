export const RESEARCH_PAIR_LANES = Object.freeze([
  { id: "s54", name: "S5.4 · Recording fingerprint", description: "Local recording-level fingerprint comparison and exact decoded-audio equality." },
  { id: "s55", name: "S5.5 · Harmonic / percussive components", description: "Component agreements from the two waveforms; these are not isolated vocal or instrument stems." },
  { id: "s56", name: "S5.6 · Up to four fragments", description: "Bounded passage-set comparison with repeated null searches and explicit resource limits." },
]);

export const RESEARCH_RECEIPT_SCHEMA = "soniccheck-mda2-diagnostic-receipt/1.0.0";
export const RESEARCH_REQUEST_SCHEMA = "soniccheck-mda2-diagnostic-request/1.0.0";
export const CANONICAL_HASH_VERSION = "soniccheck-tagged-json-f64/1.0.0";
export const RESEARCH_RECEIPT_FIELDS = Object.freeze([
  "schema_version",
  "receipt_id",
  "request_id",
  "request_sha256",
  "owner_binding_sha256",
  "created_at",
  "deployment_commit_sha",
  "left_scan_id",
  "right_scan_id",
  "selected_lanes",
  "input_custody",
  "status",
  "method_version",
  "result_sha256",
  "result",
  "provider_requests_made_by_endpoint",
  "payment_entitlements_consumed",
  "authoritative_scan_fields_changed",
]);

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const object = (value) => value != null && typeof value === "object" && !Array.isArray(value);
export const finiteNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
export const diagnosticText = (value, fallback = "UNKNOWN") => typeof value === "string" && value.trim() ? value : fallback;
export const diagnosticReasons = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
export const numberText = (value, digits = 4) => finiteNumber(value) == null ? "Not reported" : Number(value.toFixed(digits)).toString();
const booleanText = (value) => value === true ? "Yes" : value === false ? "No" : "Not reported";

function numberF64Hex(value) {
  if (!Number.isFinite(value)) throw new Error("Receipt contains a non-finite number.");
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error("Receipt contains an unsafe integer.");
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, false);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function taggedValue(value) {
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "number") return ["number-f64", numberF64Hex(value)];
  if (Array.isArray(value)) return ["array", value.map(taggedValue)];
  if (object(value)) {
    return ["object", Object.keys(value).sort().map((key) => [key, taggedValue(value[key])])];
  }
  throw new Error("Receipt contains a non-canonical value.");
}

export function canonicalJson(value) {
  return JSON.stringify([CANONICAL_HASH_VERSION, taggedValue(value)]);
}

export function buildResearchRequestContract(leftScanId, rightScanId, lanes) {
  return {
    schema_version: RESEARCH_REQUEST_SCHEMA,
    left_scan_id: leftScanId,
    right_scan_id: rightScanId,
    lanes: [...lanes],
  };
}


function cryptoProvider(value) {
  const provider = value || globalThis.crypto;
  if (!provider) throw new Error("Secure browser cryptography is unavailable.");
  return provider;
}

export async function sha256Hex(value, cryptoObject) {
  const provider = cryptoProvider(cryptoObject);
  if (!provider.subtle?.digest) throw new Error("SHA-256 verification is unavailable.");
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  if (!(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer)) throw new Error("SHA-256 input is unreadable.");
  const digest = await provider.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createResearchRequestId(cryptoObject) {
  const provider = cryptoProvider(cryptoObject);
  if (typeof provider.randomUUID === "function") {
    const value = provider.randomUUID().toLowerCase();
    if (!REQUEST_ID.test(value)) throw new Error("The browser returned an invalid request identifier.");
    return value;
  }
  if (typeof provider.getRandomValues !== "function") throw new Error("Secure request identifiers are unavailable.");
  const bytes = new Uint8Array(16);
  provider.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildResearchPairRequest(leftScanId, rightScanId, lanes, requestId = createResearchRequestId()) {
  if (typeof leftScanId !== "string" || !leftScanId.trim() || typeof rightScanId !== "string" || !rightScanId.trim()) {
    throw new Error("Choose two saved scan records.");
  }
  if (leftScanId.trim() === rightScanId.trim()) throw new Error("Choose a different saved scan for the second recording.");
  const supported = RESEARCH_PAIR_LANES.map((lane) => lane.id);
  if (!Array.isArray(lanes) || !lanes.length || lanes.some((lane) => !supported.includes(lane))) {
    throw new Error("Select at least one supported comparison method.");
  }
  const canonicalRequestId = typeof requestId === "string" ? requestId.trim().toLowerCase() : "";
  if (!REQUEST_ID.test(canonicalRequestId)) throw new Error("Create a valid diagnostic request identifier.");
  return {
    request_id: canonicalRequestId,
    left_scan_id: leftScanId.trim(),
    right_scan_id: rightScanId.trim(),
    lanes: supported.filter((lane) => lanes.includes(lane)),
  };
}

export function buildResearchReceiptEnvelope(record) {
  if (!object(record) || record.schema_version !== RESEARCH_RECEIPT_SCHEMA) {
    throw new Error("The service did not return a supported sealed receipt.");
  }
  if (record.id !== record.receipt_id) throw new Error("The receipt identifier aliases do not agree.");
  const allowed = new Set([...RESEARCH_RECEIPT_FIELDS, "id", "receipt_sha256"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error("The sealed receipt contains unexpected fields.");
  const envelope = {};
  for (const field of RESEARCH_RECEIPT_FIELDS) {
    if (!(field in record)) throw new Error(`The sealed receipt is missing ${field}.`);
    envelope[field] = record[field];
  }
  return envelope;
}

function validHash(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validateCustody(record) {
  if (!object(record.input_custody) || !object(record.input_custody.left) || !object(record.input_custody.right)) {
    throw new Error("The stored comparison is missing its input custody envelope.");
  }
  const fields = [
    "side", "scan_id", "vault_file_id", "object_key_sha256", "object_version_id",
    "object_etag", "last_modified", "declared_size_bytes", "reported_content_length",
    "encoded_size_bytes", "encoded_sha256", "content_type", "decoded_status", "decoded_pcm_sha256",
    "decoded_sample_rate_hz", "decoded_sample_count", "decoded_duration_seconds",
  ];
  for (const side of ["left", "right"]) {
    const row = record.input_custody[side];
    if (Object.keys(row).sort().join("|") !== [...fields].sort().join("|") || row.side !== side) {
      throw new Error("The stored comparison input custody has an unsupported shape.");
    }
    if (row.scan_id !== record[`${side}_scan_id`] || !validHash(row.object_key_sha256) || !validHash(row.encoded_sha256)) {
      throw new Error("The stored comparison input custody does not match its source records.");
    }
    if (!Number.isSafeInteger(row.encoded_size_bytes) || row.encoded_size_bytes <= 0) {
      throw new Error("The stored comparison input custody contains invalid bounds.");
    }
    if (!["AVAILABLE", "UNAVAILABLE", "NOT_RUN"].includes(row.decoded_status)) {
      throw new Error("The stored comparison decoded custody has an invalid status.");
    }
    if (row.decoded_status === "AVAILABLE") {
      if (!validHash(row.decoded_pcm_sha256)
        || !Number.isSafeInteger(row.decoded_sample_rate_hz) || row.decoded_sample_rate_hz <= 0
        || !Number.isSafeInteger(row.decoded_sample_count) || row.decoded_sample_count <= 0
        || !Number.isFinite(row.decoded_duration_seconds) || row.decoded_duration_seconds <= 0
        || Math.abs(row.decoded_duration_seconds - row.decoded_sample_count / row.decoded_sample_rate_hz) > 1e-9) {
        throw new Error("The stored comparison input custody contains invalid decoded bounds.");
      }
    } else if ([row.decoded_pcm_sha256, row.decoded_sample_rate_hz, row.decoded_sample_count, row.decoded_duration_seconds].some((value) => value != null)) {
      throw new Error("Unavailable decoded custody must not contain invented measurements.");
    }
    for (const optionalNumber of ["declared_size_bytes", "reported_content_length"]) {
      const value = row[optionalNumber];
      if (value != null && (!Number.isSafeInteger(value) || value < 0)) throw new Error("The stored comparison input custody contains an invalid length.");
    }
    if (row.reported_content_length != null && row.reported_content_length !== row.encoded_size_bytes) {
      throw new Error("The stored comparison input custody length does not match the retrieved bytes.");
    }
  }
}

export function validateResearchPairRecord(record, expectedLeftScanId, expectedRightScanId, expectedRequestId) {
  if (!object(record) || typeof record.id !== "string" || !record.id.trim() || typeof record.status !== "string" || !record.status.trim()) {
    throw new Error("The service did not return an identifiable saved comparison record.");
  }
  if (record.left_scan_id !== expectedLeftScanId || typeof record.right_scan_id !== "string" || !record.right_scan_id.trim() || record.right_scan_id === record.left_scan_id || (expectedRightScanId != null && record.right_scan_id !== expectedRightScanId)) {
    throw new Error("The returned comparison belongs to different source records and cannot be displayed here.");
  }
  if (expectedRequestId != null && record.request_id !== expectedRequestId) {
    throw new Error("The returned comparison belongs to a different request and cannot be displayed here.");
  }
  if (!REQUEST_ID.test(record.request_id || "")) throw new Error("The saved comparison has an invalid request identifier.");
  if (!Array.isArray(record.selected_lanes) || !record.selected_lanes.length
    || record.selected_lanes.join("|") !== [...new Set(record.selected_lanes)].sort().join("|")
    || record.selected_lanes.some((lane) => !RESEARCH_PAIR_LANES.some((item) => item.id === lane))) {
    throw new Error("The saved comparison has an invalid selected-lane contract.");
  }
  if (!object(record.result) || record.result.status !== record.status || record.result.method_version !== record.method_version) {
    throw new Error("The stored comparison result has an unreadable shape.");
  }
  if (record.result.provider_calls !== 0 || record.result.production_scoring_changed !== false || record.result.activation_allowed !== false
    || record.provider_requests_made_by_endpoint !== 0 || record.payment_entitlements_consumed !== 0 || record.authoritative_scan_fields_changed !== false) {
    throw new Error("The stored comparison violates its non-authoritative effect contract.");
  }
  validateCustody(record);
  if (!validHash(record.request_sha256) || !validHash(record.owner_binding_sha256) || !validHash(record.result_sha256) || !validHash(record.receipt_sha256)) {
    throw new Error("The stored comparison is missing its integrity seals.");
  }
  const expectedSources = [record.input_custody.left.encoded_sha256, record.input_custody.right.encoded_sha256].sort();
  if (!Array.isArray(record.result.input_source_sha256) || record.result.input_source_sha256.join("|") !== expectedSources.join("|")) {
    throw new Error("The stored comparison result is not bound to its encoded inputs.");
  }
  const decoded = record.result.decoded_input;
  if (!object(decoded) || !["AVAILABLE", "UNAVAILABLE", "NOT_RUN"].includes(decoded.status)) {
    throw new Error("The stored comparison result has no decoded-input status.");
  }
  if (decoded.status === "AVAILABLE") {
    if (record.input_custody.left.decoded_status !== "AVAILABLE" || record.input_custody.right.decoded_status !== "AVAILABLE"
      || decoded.sample_rate !== record.input_custody.left.decoded_sample_rate_hz
      || decoded.sample_rate !== record.input_custody.right.decoded_sample_rate_hz
      || decoded.sample_counts?.[0] !== record.input_custody.left.decoded_sample_count
      || decoded.sample_counts?.[1] !== record.input_custody.right.decoded_sample_count
      || decoded.durations_seconds?.[0] !== record.input_custody.left.decoded_duration_seconds
      || decoded.durations_seconds?.[1] !== record.input_custody.right.decoded_duration_seconds
      || decoded.pcm_sha256?.left !== record.input_custody.left.decoded_pcm_sha256
      || decoded.pcm_sha256?.right !== record.input_custody.right.decoded_pcm_sha256) {
      throw new Error("The stored comparison result is not bound to its decoded inputs.");
    }
  } else if (record.input_custody.left.decoded_status !== decoded.status || record.input_custody.right.decoded_status !== decoded.status
    || [decoded.sample_rate, decoded.sample_counts, decoded.durations_seconds, decoded.pcm_sha256].some((value) => value != null)) {
    throw new Error("Unavailable decoded evidence was presented as an observation.");
  }
  buildResearchReceiptEnvelope(record);
  return record;
}

export async function verifyResearchPairRecordIntegrity(record, expectedLeftScanId, expectedRightScanId, expectedRequestId, cryptoObject) {
  const validated = validateResearchPairRecord(record, expectedLeftScanId, expectedRightScanId, expectedRequestId);
  const requestDigest = await sha256Hex(canonicalJson(buildResearchRequestContract(
    validated.left_scan_id, validated.right_scan_id, validated.selected_lanes,
  )), cryptoObject);
  if (requestDigest !== validated.request_sha256) throw new Error("The saved comparison request failed its SHA-256 integrity check.");
  const resultDigest = await sha256Hex(canonicalJson(validated.result), cryptoObject);
  if (resultDigest !== validated.result_sha256) throw new Error("The saved comparison result failed its SHA-256 integrity check.");
  const receiptDigest = await sha256Hex(canonicalJson(buildResearchReceiptEnvelope(validated)), cryptoObject);
  if (receiptDigest !== validated.receipt_sha256) throw new Error("The saved comparison receipt failed its SHA-256 integrity check.");
  return validated;
}


function headerValue(headers, name) {
  if (headers?.get) return headers.get(name) || headers.get(name.toLowerCase());
  return headers?.[name] ?? headers?.[name.toLowerCase()] ?? null;
}

export async function verifyResearchHtmlReport(blob, headers, expectedReceiptHash, cryptoObject) {
  if (!(blob instanceof Blob)) throw new Error("The downloaded comparison report is unreadable.");
  const receiptHash = headerValue(headers, "X-Integrity-Hash");
  const scope = headerValue(headers, "X-Integrity-Scope");
  const reportHash = headerValue(headers, "X-Report-SHA256");
  if (scope !== "mda2-diagnostic-receipt" || receiptHash !== expectedReceiptHash) {
    throw new Error("The downloaded report is not bound to the verified comparison receipt.");
  }
  if (typeof reportHash !== "string" || !/^[0-9a-f]{64}$/.test(reportHash)) {
    throw new Error("The downloaded report is missing its file integrity hash.");
  }
  const observed = await sha256Hex(new Uint8Array(await blob.arrayBuffer()), cryptoObject);
  if (observed !== reportHash) throw new Error("The downloaded report bytes failed their SHA-256 integrity check.");
  return true;
}

export function researchPairCapabilityView(capability) {
  const mode = diagnosticText(capability?.mode);
  const canRun = capability?.available === true && capability?.can_run === true && mode === "admin_opt_in";
  return {
    mode,
    canRun,
    researchVisibilityAllowed: capability?.research_visibility_allowed === true,
    reasons: diagnosticReasons(capability?.reason_codes),
    maxSeconds: finiteNumber(capability?.max_audio_seconds),
    receiptSchemaVersion: diagnosticText(capability?.receipt_schema_version),
    summary: canRun
      ? "Available for an explicit administrator comparison."
      : mode === "disabled"
        ? "These pairwise methods are disabled in this deployment."
        : mode === "admin_opt_in"
          ? "Administrator access or a governed runtime prerequisite is unavailable."
          : "Runtime availability is UNKNOWN. No comparison can be started.",
  };
}

export function researchRuntimeRows(payload) {
  return [["v16r", "V16R"], ["v30", "V30"], ["eight_channel_observer", "Eight-channel observer"]].map(([id, name]) => ({
    id,
    name,
    mode: diagnosticText(payload?.[id]?.configured_mode),
    effectiveStatus: diagnosticText(payload?.[id]?.effective_status),
    executionState: diagnosticText(payload?.[id]?.execution_state),
    blockers: Array.isArray(payload?.[id]?.blockers) ? payload[id].blockers.filter((blocker) => object(blocker)).map((blocker) => ({
      reason: diagnosticText(blocker.reason_code), continuation: diagnosticText(blocker.continuation_id),
    })) : [],
  }));
}

export function researchLaneView(id, lane, canonicalProfileSource = {}) {
  const method = RESEARCH_PAIR_LANES.find((entry) => entry.id === id);
  if (!method) throw new Error("Unsupported comparison method.");
  if (!object(lane)) return { ...method, status: "NOT RETURNED", reasons: [], metrics: [], components: [], notes: ["No result was returned for this method. Missing evidence is not a zero score."] };
  const view = { ...method, methodId: diagnosticText(lane.method_id, diagnosticText(lane.method_version, "Not reported")), status: diagnosticText(lane.status), reasons: diagnosticReasons(lane.reason_codes), metrics: [], components: [], notes: [] };
  if (id === "s54") {
    view.metrics = [
      ["Exact decoded PCM equality", booleanText(lane.input_pcm_exact_equal)],
      ["Exact input-array byte equality", booleanText(lane.input_array_bytes_equal)],
      ["Fingerprint agreement (0–1)", numberText(lane.fingerprint_similarity)],
      ["Differing fingerprint bits", numberText(lane.hamming_bit_errors, 0)],
      ["Compared fingerprint bits", numberText(lane.compared_bits, 0)],
      ["Overlapping fingerprint words", numberText(lane.overlap_words, 0)],
      ["Absolute offset (words)", numberText(lane.absolute_offset_words, 0)],
      ["Offsets tested", numberText(lane.tested_offsets, 0)],
    ];
    view.notes = ["Fingerprint agreement is descriptive recording evidence. It is not a calibrated identity decision or composition proof. PCM equality concerns decoded input samples, not the original encoded file bytes."];
  } else if (id === "s55") {
    view.components = ["harmonic", "percussive"].map((name) => {
      const component = object(lane.components?.[name]) ? lane.components[name] : {};
      return { name, status: diagnosticText(component.status, "NOT RETURNED"), reasons: diagnosticReasons(component.reason_codes), metrics: [
        ["Aligned spectral agreement (0–1)", numberText(component.aligned_spectral_cosine)],
        ["Envelope agreement (0–1)", numberText(component.envelope_cosine)],
      ] };
    });
    view.metrics = ["left", "right"].flatMap((side) => {
      const separation = lane.separation?.[side];
      return [
        [`${side === "left" ? "First" : "Second"} duration (seconds)`, numberText(separation?.duration_seconds, 3)],
        [`${side === "left" ? "First" : "Second"} reconstruction relative RMS error`, finiteNumber(separation?.reconstruction_relative_rms_error) == null ? "Not reported" : separation.reconstruction_relative_rms_error.toExponential(3)],
      ];
    });
    view.notes = ["Both components come from the same waveform. Shared loops, timbre and separation leakage can produce agreement without shared composition. Unequal timelines and insufficient component energy remain unavailable; they are not replaced by zero agreement."];
  } else if (id === "s56") {
    view.metrics = [
      ["Complete bounded search", booleanText(lane.search_complete)],
      ["Selected fragments", numberText(lane.selected?.fragment_count, 0)],
      ["Observed statistic", numberText(lane.selected?.observed_statistic)],
      ["Completed null searches", numberText(lane.null?.completed, 0)],
      ["Requested null searches", numberText(lane.null?.requested, 0)],
      ["Surrogate tail fraction", numberText(lane.null?.tail_fraction, 6)],
      ["Minimum resolvable tail fraction", numberText(lane.null?.minimum_resolvable_tail_fraction, 6)],
      ["Formal null support met", booleanText(lane.null?.formal_null_support_satisfied)],
      ["Formal S5 scientific gate met", booleanText(lane.null?.formal_s5_scientific_gate_satisfied)],
    ];
    if (typeof lane.reason === "string" && !view.reasons.includes(lane.reason)) view.reasons.push(lane.reason);
    view.fragments = Array.isArray(lane.selected?.fragments) ? lane.selected.fragments.map((fragment) => ({
      matchedAtoms: numberText(fragment?.matched_atoms, 0),
      normalisedSeconds: numberText(fragment?.normalised_coverage_seconds, 3),
      profileA: intervalText(fragment?.profile_a_interval_seconds),
      profileB: intervalText(fragment?.profile_b_interval_seconds),
    })) : [];
    view.profileALabel = canonicalProfileLabel("profile_a", canonicalProfileSource);
    view.profileBLabel = canonicalProfileLabel("profile_b", canonicalProfileSource);
    view.notes = ["The surrogate tail fraction is not a match probability. Nineteen or 99 null searches are development mechanics only; even 999 do not complete the independent scientific gates. Fragment intervals use canonical profile A/B order, which may differ from the first/second scan order."];
  }
  return view;
}

function canonicalProfileLabel(profile, binding) {
  const suffix = profile === "profile_a" ? "profile A" : "profile B";
  const side = binding?.[profile];
  return side === "left" ? `First scan (${suffix})`
    : side === "right" ? `Second scan (${suffix})`
      : side === "both" ? `Both scans (${suffix})`
        : `Source unresolved (${suffix})`;
}

function intervalText(value) {
  return Array.isArray(value) && value.length === 2 && value.every((item) => finiteNumber(item) != null)
    ? `${numberText(value[0], 3)}–${numberText(value[1], 3)} s`
    : "Not reported";
}
