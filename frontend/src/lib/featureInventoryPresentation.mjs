export const FEATURE_INVENTORY_SCHEMA = "soniccheck-scan-feature-inventory/1.0.0";
export const FEATURE_INVENTORY_INTERPRETATION = "Six named analytical entries within three evidence channels. The four composition features share the same comparison pipeline. Completed means the stated calculation or source check ran; it does not establish accuracy, originality or clearance.";

export const RUNTIME_FEATURES = Object.freeze([
  ["recording_identity", "Recording identity", "Recording identity", "recording_identity", "audio", "Provider recording candidates are not composition conclusions. Provider-side comparison totals are not disclosed."],
  ["lyric_phrase_overlap", "Lyric phrase overlap", "Lyric overlap", "lyric_phrase_overlap", "submitted_lyrics", "Exact normalized phrases in retrieved text only; no sung-word transcription or semantic paraphrase analysis."],
  ["harmonic_pitch_classes", "Harmonic pitch classes", "Composition comparison", "composition_similarity", "audio_and_eligible_reference", "Pitch-class energy agreement, not chord transcription; common harmony may agree strongly."],
  ["dominant_pitch_class_contour", "Dominant pitch-class contour", "Composition comparison", "composition_similarity", "audio_and_eligible_reference", "Changes in the strongest pitch class of the mix, not isolated melody or note transcription."],
  ["onset_pattern", "Onset pattern", "Composition comparison", "composition_similarity", "audio_and_eligible_reference", "Positive frame-energy changes, not beat, meter or tempo transcription."],
  ["coarse_harmonic_sequence", "Coarse harmonic sequence", "Composition comparison", "composition_similarity", "audio_and_eligible_reference", "Eight broad chroma segments, not verse/chorus detection or local passage alignment."],
].map(([id, label, channel, parentChannel, inputRequirement, limitation]) => Object.freeze({
  id, label, channel, parentChannel, inputRequirement, limitation,
})));

const STATUS_LABELS = Object.freeze({
  NOT_SUBMITTED: "Not submitted",
  UNAVAILABLE: "Unavailable",
  INSUFFICIENT_SIGNAL: "Insufficient signal",
  NO_ELIGIBLE_REFERENCES: "No eligible references",
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  UNREPORTED: "Not reported",
});

const INPUT_LABELS = Object.freeze({
  audio: "Submitted audio",
  submitted_lyrics: "Submitted lyric text",
  audio_and_eligible_reference: "Submitted audio and an eligible reference",
});

const object = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const text = (value, fallback = "") => typeof value === "string" && value.trim()
  ? value.trim().slice(0, 1000) : fallback;

const validEntry = (entry, feature) => {
  if (!object(entry)
    || entry.feature_id !== feature.id || entry.label !== feature.label
    || entry.parent_channel !== feature.parentChannel
    || entry.input_requirement !== feature.inputRequirement
    || entry.limitation !== feature.limitation
    || !(entry.method_version === null || typeof entry.method_version === "string")) return false;
  const status = entry.execution_status;
  if (!Object.hasOwn(STATUS_LABELS, status) || status === "UNREPORTED") return false;
  const count = entry.completed_comparison_count;
  const active = ["COMPLETED", "PARTIAL"].includes(status);
  return count === null
    ? feature.id === "recording_identity" && status === "COMPLETED"
    : nonnegativeInteger(count) && (active || count === 0)
      && (feature.parentChannel !== "composition_similarity" || !active || count > 0);
};

const validInventory = (value) => object(value)
  && value.schema_version === FEATURE_INVENTORY_SCHEMA
  && value.inventory_scope === "CURRENT_RUNTIME_CAPABILITIES"
  && value.channel_count === 3
  && value.feature_count === RUNTIME_FEATURES.length
  && value.interpretation === FEATURE_INVENTORY_INTERPRETATION
  && Array.isArray(value.features) && value.features.length === RUNTIME_FEATURES.length
  && value.features.every((entry, index) => validEntry(entry, RUNTIME_FEATURES[index]));

const sameValue = (left, right) => {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  }
  if (!object(left) || !object(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
};

// A legacy overall score or channel status cannot prove that an individual
// feature ran. Only the persisted per-feature execution contract supplies it.
export function featureInventoryView(result = {}) {
  const root = object(result) ? result.feature_inventory : undefined;
  const evidence = object(result?.evidence) ? result.evidence.feature_inventory : undefined;
  const inventory = root ?? evidence;
  const projectionsAgree = root == null || evidence == null || sameValue(root, evidence);
  const reported = validInventory(inventory) && projectionsAgree;
  const rows = RUNTIME_FEATURES.map((feature, index) => {
    const entry = reported ? inventory.features[index] : null;
    const suppliedCount = entry?.completed_comparison_count;
    const status = reported ? entry.execution_status : "UNREPORTED";
    const completedComparisons = reported && nonnegativeInteger(suppliedCount) ? suppliedCount : null;
    const countLabel = completedComparisons !== null ? completedComparisons.toLocaleString("en-AU")
      : reported && feature.id === "recording_identity" && status === "COMPLETED"
        ? "Not disclosed by provider" : "Not reported";
    return {
      ...feature,
      status,
      statusLabel: STATUS_LABELS[status],
      completedComparisons,
      countLabel,
      inputRequirement: INPUT_LABELS[feature.inputRequirement],
      methodVersion: reported ? text(entry.method_version) : "",
      limitation: reported ? text(entry.limitation)
        : "Per-feature execution evidence is unavailable in this saved scan.",
    };
  });
  return {
    reported,
    fullyReported: reported && rows.every((row) => row.status !== "UNREPORTED"),
    rows,
    completedFeatureCount: rows.filter((row) => row.status === "COMPLETED").length,
    partialFeatureCount: rows.filter((row) => row.status === "PARTIAL").length,
    description: "Six feature checks across three analysis channels. Four composition checks describe different aspects of the same audio comparison.",
  };
}
