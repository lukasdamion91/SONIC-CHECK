const count = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
};

const recordingMatches = (result) => (result.matches || []).filter(
  (match) => match?.analysis_type === "recording_identity",
);

const lyricMatches = (result) => (result.matches || []).filter(
  (match) => match?.analysis_type === "lyric_phrase_overlap",
);

const sourceFor = (result, modality) => (result.evidence?.sources || []).find(
  (source) => source?.modality === modality,
) || {};

const submitted = (result, modality) => {
  const modes = result.scan_modes || {};
  const provenance = result.evidence?.provenance || {};
  if (modality === "audio") {
    return modes.audio === true || provenance.audio?.submitted === true;
  }
  return modes.lyrics === true || provenance.lyrics?.submitted === true;
};

const candidateCoverage = (candidateCount) => (
  `${candidateCount} candidate${candidateCount === 1 ? "" : "s"} returned`
);

export function buildChannelCoverageRows(result = {}) {
  const audioSubmitted = submitted(result, "audio");
  const lyricsSubmitted = submitted(result, "lyrics");
  const recordingSource = sourceFor(result, "recording_identity");
  const recording = result.fingerprint || {};
  const recordingCandidateCount = Math.max(
    recordingMatches(result).length,
    count(recordingSource.candidate_count),
  );
  const recordingUsable = [0, 1001].includes(
    Number(recording.status_code ?? recordingSource.status_code),
  );

  let recordingRow;
  if (!audioSubmitted) {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: "Not submitted",
      state: "not_submitted",
      outcome: "Not submitted",
      coverage: "No recording-identity search",
    };
  } else if (recordingCandidateCount > 0) {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "candidate_evidence",
      outcome: "Candidate evidence returned",
      coverage: candidateCoverage(recordingCandidateCount),
    };
  } else if (recordingUsable) {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "searched_no_candidate",
      outcome: "Decoded and searched — no candidate",
      coverage: "Configured provider search completed",
    };
  } else {
    recordingRow = {
      key: "recording_identity",
      channel: "Recording identity",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "unavailable_degraded",
      outcome: "Unavailable or degraded",
      coverage: recording.status_msg || recordingSource.status || "No usable provider result",
    };
  }

  const lyric = result.lyric_analysis || {};
  const lyricSource = sourceFor(result, "lyric_phrase_overlap");
  const lyricCandidateCount = Math.max(lyricMatches(result).length, count(lyricSource.candidate_count));
  const candidatesChecked = Math.max(count(lyric.candidates_checked), count(lyricSource.candidates_with_text));
  const lyricUsable = lyric.source_usable === true
    || (lyric.source_usable == null && count(lyricSource.queries_succeeded) > 0);

  let lyricRow;
  if (!lyricsSubmitted) {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Not submitted",
      state: "not_submitted",
      outcome: "Not submitted",
      coverage: "No lyric search",
    };
  } else if (lyricCandidateCount > 0) {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Lyrics submitted",
      state: "candidate_evidence",
      outcome: "Candidate evidence returned",
      coverage: `${candidateCoverage(lyricCandidateCount)}; ${candidatesChecked} candidate text${candidatesChecked === 1 ? "" : "s"} checked`,
    };
  } else if (lyricUsable) {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Lyrics submitted",
      state: "searched_no_candidate",
      outcome: "Searched — no candidate",
      coverage: `${candidatesChecked} candidate text${candidatesChecked === 1 ? "" : "s"} checked`,
    };
  } else {
    lyricRow = {
      key: "lyric_overlap",
      channel: "Lyric overlap",
      input: "Lyrics submitted",
      state: "unavailable_degraded",
      outcome: "Unavailable or degraded",
      coverage: lyric.summary || lyricSource.status || "No usable lyric-source result",
    };
  }

  const composition = result.composition_analysis || {};
  const comparisons = Array.isArray(composition.comparisons) ? composition.comparisons : [];
  const completed = comparisons.filter((comparison) => comparison?.composition_signal_percent != null).length;
  const completedCount = Math.max(count(composition.successful_comparison_count), completed);
  const consideredCount = Math.max(
    count(composition.catalogue_entries_considered),
    comparisons.length,
    completedCount,
  );
  const unavailableCount = Math.max(count(composition.references_unavailable), consideredCount - completedCount);
  const noComparableReference = new Set([
    "NO_COMPARABLE_REFERENCE",
    "REFERENCE_NOT_REGISTERED",
    "NO_CANDIDATES",
  ]).has(composition.status);

  let compositionRow;
  if (!audioSubmitted || composition.status === "AUDIO_NOT_SUBMITTED") {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: "Not submitted",
      state: "not_submitted",
      outcome: "Not submitted",
      coverage: "Audio is required for comparison",
    };
  } else if (completedCount > 0) {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "comparison_coverage",
      outcome: "Named-reference comparisons completed",
      coverage: `${completedCount} of ${consideredCount} selected reference${consideredCount === 1 ? "" : "s"} compared${unavailableCount ? `; ${unavailableCount} unavailable` : ""}`,
    };
  } else if (noComparableReference) {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "searched_no_candidate",
      outcome: "Searched — no comparable named reference",
      coverage: `${consideredCount} selected references compared`,
    };
  } else {
    compositionRow = {
      key: "composition_similarity",
      channel: "Composition comparison",
      input: result.audio_input?.status === "DECODED" ? "Decoded audio" : "Audio submitted",
      state: "unavailable_degraded",
      outcome: "Unavailable or degraded",
      coverage: composition.reason || "No successful named-reference comparison",
    };
  }

  return [recordingRow, lyricRow, compositionRow];
}

export function compositionComparisonDisclosure(composition = {}) {
  const comparisons = Array.isArray(composition.comparisons) ? composition.comparisons : [];
  const completed = comparisons.filter((comparison) => comparison?.composition_signal_percent != null).length;
  const completedCount = Math.max(count(composition.successful_comparison_count), completed);
  if (completedCount === 0) return null;
  const consideredCount = Math.max(
    count(composition.catalogue_entries_considered),
    comparisons.length,
    completedCount,
  );
  return {
    completedCount,
    consideredCount,
    text: (
      `The highest displayed composition signal is the top of ${completedCount} successful `
      + `comparison${completedCount === 1 ? "" : "s"} among ${consideredCount} selected `
      + `reference${consideredCount === 1 ? "" : "s"}. No multiple-comparison adjustment was applied.`
    ),
  };
}
