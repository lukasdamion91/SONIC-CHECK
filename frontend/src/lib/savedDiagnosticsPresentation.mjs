// Presentation of the saved extension only. No audio, provider calls or scoring.
export const EXTENSION_SCHEMA = "harry-analysis-extensions/0.1.0-candidate";
const mapping = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const finite = (value, min = -Infinity, max = Infinity) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const scalar = (value, min, max) => finite(value, min, max) ? value : null;
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
const text = (value, fallback = "Not recorded") => typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : fallback;
export const diagnosticNumber = (value, places = 3) => finite(value) ? value.toFixed(places) : "Not measured";

function spectrumView(value) {
  const spectrum = mapping(value);
  const f = spectrum.frequency_hz;
  const p = spectrum.power_density_db_re_fs2_per_hz;
  if (spectrum.status !== "MEASURED_SIGNAL_SPECTRUM" || !Array.isArray(f) || !Array.isArray(p)
    || f.length < 2 || f.length > 1025 || f.length !== p.length
    || f.some((x, i) => !finite(x, 0) || (i > 0 && x <= f[i - 1]))
    || p.some((x) => !finite(x, -180.000001, 100))) return null;
  const points = f.flatMap((hz, i) => hz >= 20 && hz <= 20000 ? [{ hz, db: p[i] }] : []);
  if (points.length < 2) return null;
  return { points, fft: integer(spectrum.n_fft, 1, 1000000), hop: integer(spectrum.hop_samples, 1, 1000000), tail: integer(spectrum.unframed_tail_samples, 0, 10000000) };
}

export function savedDiagnosticsView(value) {
  if (value == null) return { state: "absent", message: "Additional audio measurements were not recorded for this scan. No measurements have been reconstructed." };
  const extension = mapping(value);
  if (extension.schema_version !== EXTENSION_SCHEMA) return { state: "unsupported", message: "An extension record is present, but its schema is unsupported. No measurements have been reconstructed." };
  const acoustic = mapping(extension.acoustic_diagnostics);
  const receipt = mapping(acoustic.decode_receipt);
  const coverage = mapping(acoustic.coverage);
  const measured = acoustic.execution_status === "COMPLETED";
  const timbre = mapping(acoustic.timbre);
  const features = mapping(timbre.features);
  const tempo = mapping(acoustic.tempo);
  const vocal = mapping(extension.vocal_and_transcription);
  const review = mapping(extension.final_evidence_review);
  const rows = measured && Array.isArray(acoustic.channels) ? acoustic.channels.slice(0, 8).filter((r) => r !== null && typeof r === "object" && !Array.isArray(r)) : [];
  return {
    state: "supported", schema: EXTENSION_SCHEMA,
    status: measured ? "COMPLETED" : text(acoustic.status, "NOT_RECORDED"),
    reason: text(acoustic.reason_code, ""),
    measuredSeconds: measured ? scalar(coverage.analyzed_duration_seconds, 0, 60) : null,
    decodedSeconds: scalar(receipt.decoded_seconds, 0, 60),
    sourceSeconds: scalar(receipt.source_duration_seconds, 0),
    startSeconds: scalar(receipt.window_start_seconds, 0),
    sourceRate: integer(receipt.source_sample_rate_hz, 8000, 192000),
    sourceChannels: integer(receipt.source_channel_count, 1, 8),
    coverage: ["PARTIAL", "FULL_SELECTED_STREAM"].includes(receipt.coverage) ? receipt.coverage : "NOT_RECORDED",
    nativePreserved: receipt.normalization_applied === false && receipt.resampling_requested === false && receipt.channel_downmix_requested === false,
    spectrum: measured ? spectrumView(acoustic.spectrum) : null,
    channels: rows.map((row) => ({
      index: integer(row.channel_index, 0, 7),
      peak: scalar(row.sample_peak_fs, 0, 16), rms: scalar(row.rms_fs, 0, 16),
      dc: scalar(row.dc_offset_fs, -16, 16), crest: scalar(row.crest_factor_db, 0),
      nearRail: finite(row.near_full_scale_sample_fraction, 0, 1) ? 100 * row.near_full_scale_sample_fraction : null,
    })),
    timbreStatus: text(timbre.status),
    timbre: [["centroid_hz", "Spectral centroid", "Hz"], ["bandwidth_hz", "Spectral bandwidth", "Hz"], ["rolloff_85_hz", "85% magnitude rolloff", "Hz"], ["flatness", "Power spectral flatness", ""]].map(([key, label, unit]) => ({
      key, label, unit, value: measured && timbre.status === "DESCRIPTIVE_FEATURES" ? scalar(mapping(features[key]).mean, 0, key === "flatness" ? 1 : 96000) : null,
    })),
    tempoStatus: text(tempo.status, "NOT_MEASURED"),
    bpms: measured && tempo.status === "UNCALIBRATED_PERIODICITY_CANDIDATES" && Array.isArray(tempo.candidates) ? tempo.candidates.slice(0, 5).map((r) => scalar(mapping(r).bpm, 1, 1000)).filter((bpm) => bpm !== null) : [],
    vocalStatus: text(vocal.status, "NOT_RUN"), separationStatus: text(mapping(vocal.source_separation).status, "NOT_RUN"),
    reviewStatus: text(review.status, "NOT_RECORDED"),
    issues: Array.isArray(review.issues) ? review.issues.slice(0, 6).filter((r) => r !== null && typeof r === "object" && !Array.isArray(r)).map((r) => ({ code: text(r.code, "UNRESOLVED"), path: text(r.path ?? r.field, "") })) : [],
    // A contradictory saved declaration must remain visible, never normalized.
    boundaryWarning: extension.aggregate_score_modified === true ? "The saved extension declares a score modification. This viewer does not validate that declaration or recalculate the score." : "",
  };
}
