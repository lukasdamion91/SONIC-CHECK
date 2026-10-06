import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileAudio, FileText, Loader2, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import ScannerAnalyzer from "@/components/ScannerAnalyzer";
import ScanResultsOverview from "@/components/ScanResultsOverview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCAN } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { AUDIO_UPLOAD_LIMIT_LABEL, audioUploadValidationError } from "@/lib/audioUpload.mjs";
import { INITIAL_SCAN_PROGRESS, scanProgressReducer, uploadCompletedByEvent } from "@/lib/scanProgress.mjs";
import {
  createScanPostRecovery,
  createScanProgressId,
  parseScanProgressResponse,
  scanPollFailureDecision,
  SCAN_POST_PENDING_TIMEOUT_MS,
  SCAN_RECONCILIATION_RETRY_MS,
} from "@/lib/scanProgressPolling.mjs";

export default function NewScan() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [regions, setRegions] = useState([]);
  const [form, setForm] = useState({ title: "", artist_name: user?.name || "", lyrics: "", region: user?.region || "AU", reference_lyrics: "", reference_lyrics_title: "", reference_lyrics_authorized: false });
  const [audioFile, setAudioFile] = useState(null);
  const [candidateShadowRequested, setCandidateShadowRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationNotice, setReconciliationNotice] = useState("");
  const [ambiguousOutcome, setAmbiguousOutcome] = useState(false);
  const [error, setError] = useState("");
  const [scanProgress, dispatchScanProgress] = useReducer(scanProgressReducer, INITIAL_SCAN_PROGRESS);
  const progressPollRef = useRef(null);
  const activeUploadRef = useRef(null);
  const terminalStateRef = useRef(null);

  const stopProgressPolling = useCallback(() => {
    const activePoll = progressPollRef.current;
    if (!activePoll) return;
    if (activePoll.timer) window.clearTimeout(activePoll.timer);
    activePoll.recovery?.cancel();
    activePoll.controller.abort();
    progressPollRef.current = null;
  }, []);

  const abortActiveUpload = useCallback(() => {
    const activeUpload = activeUploadRef.current;
    if (!activeUpload) return;
    if (activeUpload.deadline) window.clearTimeout(activeUpload.deadline);
    activeUpload.controller.abort();
    activeUploadRef.current = null;
  }, []);

  const completeSubmission = useCallback((scanId) => {
    if (!scanId || terminalStateRef.current) return;
    terminalStateRef.current = { state: "completed", scanId };
    stopProgressPolling();
    abortActiveUpload();
    setSubmitting(false);
    setReconciling(false);
    setReconciliationNotice("");
    setAmbiguousOutcome(false);
    dispatchScanProgress({ type: "COMPLETE" });
    void refresh();
    toast.success("Evidence record created");
    navigate(`/app/scans/${scanId}`);
  }, [abortActiveUpload, navigate, refresh, stopProgressPolling]);

  const failSubmission = useCallback((message, state) => {
    if (terminalStateRef.current) return;
    terminalStateRef.current = { state: "failed" };
    stopProgressPolling();
    abortActiveUpload();
    setSubmitting(false);
    setReconciling(false);
    setReconciliationNotice("");
    setAmbiguousOutcome(["recovery_timeout", "recovery_unavailable"].includes(state));
    setError(message);
    dispatchScanProgress({ type: "FAIL", message, state });
    toast.error(message);
  }, [abortActiveUpload, stopProgressPolling]);

  const startProgressPolling = useCallback((progressId) => {
    if (!progressId || progressPollRef.current?.progressId === progressId) return;
    stopProgressPolling();

    const activePoll = {
      progressId,
      controller: new AbortController(),
      timer: null,
      notFoundAttempts: 0,
      unavailableAttempts: 0,
      transportAttempts: 0,
      uploadComplete: false,
      recovery: null,
    };
    activePoll.recovery = createScanPostRecovery({
      progressId,
      onCompleted: completeSubmission,
      onFailed: failSubmission,
      onRecoveryStarted: (reason) => {
        const notice = reason === "pending_timeout"
          ? "The maximum upload-response wait ended. SonicCheck stopped waiting for that response and is checking the owner-scoped durable record. Do not start another analysis yet."
          : reason === "user_stop"
            ? "SonicCheck stopped waiting for the upload response and is checking the owner-scoped durable record. Do not start another analysis yet."
            : "The upload response was interrupted. SonicCheck is checking the owner-scoped durable record before it is safe to retry.";
        setReconciling(true);
        setReconciliationNotice(notice);
        toast.message(notice);
        const activeUpload = activeUploadRef.current;
        if (activeUpload?.progressId === progressId) {
          if (activeUpload.deadline) window.clearTimeout(activeUpload.deadline);
          activeUpload.controller.abort();
          activeUploadRef.current = null;
        }
      },
      setTimer: window.setTimeout,
      clearTimer: window.clearTimeout,
    });
    progressPollRef.current = activePoll;

    const schedule = (delay) => {
      if (progressPollRef.current !== activePoll || activePoll.controller.signal.aborted) return;
      activePoll.timer = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      if (progressPollRef.current !== activePoll || activePoll.controller.signal.aborted) return;
      try {
        const { data } = await api.get(`/scans/progress/${progressId}`, {
          signal: activePoll.controller.signal,
        });
        const report = parseScanProgressResponse(data, progressId);
        if (!report) {
          dispatchScanProgress({ type: "COMPONENT_TELEMETRY_UNAVAILABLE" });
          // Invalid optional telemetry must not discard the owner-scoped
          // reconciliation handle while the authoritative POST is unresolved.
          schedule(SCAN_RECONCILIATION_RETRY_MS);
          return;
        }

        activePoll.notFoundAttempts = 0;
        activePoll.unavailableAttempts = 0;
        activePoll.transportAttempts = 0;
        activePoll.uploadComplete = true;
        dispatchScanProgress({
          type: "SERVER_PROGRESS",
          progressPercent: report.progressPercent,
          stage: report.stage,
          state: report.state,
          componentActivity: report.componentActivity,
        });

        if (report.state === "completed") {
          // The durable progress record recovers a successful scan even if
          // the long-running upload POST response is lost at the browser.
          if (!activePoll.recovery.handleProgress(report)) completeSubmission(report.scanId);
          return;
        }
        if (report.state === "failed") {
          const message = report.errorCode
            ? `The server stopped this analysis (${report.errorCode}).`
            : "The server stopped this analysis before a result was stored.";
          if (!activePoll.recovery.handleProgress(report, message)) failSubmission(message, report.state);
          return;
        }

        schedule(report.retryAfterMs);
      } catch (pollError) {
        if (activePoll.controller.signal.aborted) return;
        dispatchScanProgress({ type: "COMPONENT_TELEMETRY_UNAVAILABLE" });
        const status = pollError?.response?.status;
        const retry = scanPollFailureDecision({
          status,
          uploadComplete: activePoll.uploadComplete,
          notFoundAttempts: activePoll.notFoundAttempts,
          unavailableAttempts: activePoll.unavailableAttempts,
          transportAttempts: activePoll.transportAttempts,
          retryAfterSeconds: pollError?.response?.headers?.get?.("retry-after")
            ?? pollError?.response?.headers?.["retry-after"],
        });
        activePoll.notFoundAttempts = retry.notFoundAttempts;
        activePoll.unavailableAttempts = retry.unavailableAttempts;
        activePoll.transportAttempts = retry.transportAttempts;
        // Progress telemetry is optional. Keep the owner-scoped handle alive;
        // the pending and reconciliation deadlines bound the operation.
        schedule(retry.retryAfterMs);
      }
    };

    void poll();
  }, [completeSubmission, failSubmission, stopProgressPolling]);

  const stopWaitingAndReconcile = () => {
    const activePoll = progressPollRef.current;
    if (activePoll?.recovery.start(
      { code: "USER_STOP_RECONCILE" },
      activePoll.progressId,
      "user_stop",
    )) return;
    failSubmission(
      "SonicCheck stopped waiting, but this browser could not reconcile whether the server stored the submission. Do not immediately retry; check your dashboard first.",
      "recovery_unavailable",
    );
  };

  useEffect(() => () => {
    terminalStateRef.current ||= { state: "unmounted" };
    stopProgressPolling();
    abortActiveUpload();
  }, [abortActiveUpload, stopProgressPolling]);

  useEffect(() => {
    if (user?.role !== "admin") setCandidateShadowRequested(false);
  }, [user?.role]);

  useEffect(() => {
    api.get("/regions")
      .then(({ data }) => setRegions(data))
      .catch(() => setRegions([
        { code: "AU", name: "Australia", context: "Regional context recorded" },
        { code: "US", name: "United States", context: "Regional context recorded" },
        { code: "UK", name: "United Kingdom", context: "Regional context recorded" },
      ]));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (ambiguousOutcome) {
      setError("Check the dashboard for the prior submission before starting another analysis.");
      return;
    }
    if (!form.lyrics.trim() && !audioFile) {
      setError("Add an audio file, lyrics, or both before starting the analysis.");
      return;
    }
    const audioValidationError = audioUploadValidationError(audioFile);
    if (audioValidationError) {
      setError(audioValidationError);
      return;
    }
    if (candidateShadowRequested && user?.role !== "admin") {
      setCandidateShadowRequested(false);
      setError("The V37 eight-channel diagnostic is restricted to an authenticated administrator.");
      return;
    }
    if (candidateShadowRequested && !audioFile) {
      setError("Add an audio file before requesting the V37 eight-channel diagnostic.");
      return;
    }

    const payload = new FormData();
    if (form.reference_lyrics.trim()) {
      if (!form.lyrics.trim() || !form.reference_lyrics_authorized) {
        setError("Add submitted lyrics and confirm permission to compare the reference text.");
        setSubmitting(false);
        return;
      }
      payload.append("reference_lyrics", form.reference_lyrics);
      payload.append("reference_lyrics_title", form.reference_lyrics_title);
      payload.append("reference_lyrics_authorized", "true");
    }
    payload.append("title", form.title.trim());
    payload.append("artist_name", form.artist_name.trim());
    payload.append("lyrics", form.lyrics);
    payload.append("region", form.region);
    if (audioFile) payload.append("file", audioFile);
    if (candidateShadowRequested && user?.role === "admin") {
      payload.append("candidate_shadow", "true");
    }
    const progressId = createScanProgressId();
    if (progressId) payload.append("progress_id", progressId);
    const uploadController = new AbortController();

    terminalStateRef.current = null;
    setReconciling(false);
    setReconciliationNotice("");
    setAmbiguousOutcome(false);
    activeUploadRef.current = { controller: uploadController, progressId, deadline: null };
    if (!progressId) {
      activeUploadRef.current.deadline = window.setTimeout(() => {
        failSubmission(
          "The maximum wait ended, and this browser could not reconcile whether the server stored the submission. Do not immediately retry; check your dashboard first.",
          "recovery_unavailable",
        );
      }, SCAN_POST_PENDING_TIMEOUT_MS);
    }
    setSubmitting(true);
    dispatchScanProgress({ type: "BEGIN" });
    if (progressId) startProgressPolling(progressId);
    try {
      const { data } = await api.post("/scans/upload", payload, {
        signal: uploadController.signal,
        // Analysis is a long-running upload operation. Ordinary API calls keep
        // the shared outage timeout; this request is bounded by the visible
        // stop-waiting action and the durable-progress deadlines instead.
        timeout: 0,
        onUploadProgress: (event) => {
          dispatchScanProgress({ type: "UPLOAD_PROGRESS", event });
          if (progressId && uploadCompletedByEvent(event) && progressPollRef.current?.progressId === progressId) {
            progressPollRef.current.uploadComplete = true;
          }
        },
      });
      if (typeof data?.id !== "string" || !data.id) {
        failSubmission("The server stored no usable evidence-record identifier.");
        return;
      }
      completeSubmission(data.id);
    } catch (requestError) {
      // Polling may already have supplied the durable terminal result and
      // deliberately cancelled the still-pending POST request.
      if (terminalStateRef.current) return;
      const activePoll = progressPollRef.current;
      if (activePoll?.recovery.awaitingRecovery) return;
      if (activePoll?.recovery.start(requestError, activePoll.progressId)) {
        return;
      }
      if (requestError?.response == null) {
        failSubmission(
          "The upload connection ended without a response, and this browser could not reconcile whether the server stored the submission. Do not immediately retry; check your dashboard first.",
          "recovery_unavailable",
        );
        return;
      }
      const message = formatApiErrorDetail(requestError?.response?.data?.detail);
      failSubmission(message);
    } finally {
      if (activeUploadRef.current?.controller === uploadController) {
        activeUploadRef.current = null;
      }
    }
  };

  return (
    <main className="new-scan-page mx-auto max-w-7xl px-6 py-14">
      <div className="sc-analysis-flow relative z-10">
      <form onSubmit={submit} aria-busy={submitting} className="sc-audio-upload-form">
        <section className="scan-intake-panel sc-audio-upload-panel space-y-6 rounded-xl border p-6 sm:p-8" aria-labelledby="audio-upload-heading">
          <header>
            <h1 id="audio-upload-heading" className="sc-audio-upload-heading">AUDIO UPLOAD</h1>
            <p className="mt-3 text-sm">Choose your track, then start the analysis.</p>
          </header>
          <div>
            <div className="space-y-2">
              <Label htmlFor="audio" className="text-[#f3f2eb]/78">Audio file</Label>
              <p className="sc-audio-formats">WAV <span>(.wav)</span> · AIFF <span>(.aiff, .aif)</span> · FLAC <span>(.flac)</span> · MP3 <span>(.mp3)</span> · M4A <span>(.m4a)</span></p>
            </div>
            <label htmlFor="audio" data-disabled={submitting ? "true" : "false"} className="audio-drop-zone sc-audio-upload-picker mt-3 flex min-h-32 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#101b25] p-6 text-center hover:border-[#9DB8F0]/45">
              <div>
                {audioFile ? <FileAudio className="mx-auto h-7 w-7 text-[#bcebd8]" /> : <Upload className="mx-auto h-7 w-7 text-[#9DB8F0]" />}
                <div className="mt-3 text-sm text-[#f3f2eb]">{audioFile ? audioFile.name : "Choose an audio file"}</div>
                <div className="mt-1 text-xs text-[#f3f2eb]/70">Up to {AUDIO_UPLOAD_LIMIT_LABEL}. Your file must decode successfully before analysis.</div>
              </div>
            </label>
            <input id="audio" data-testid={SCAN.audioFileInput} disabled={submitting} type="file" accept="audio/wav,audio/x-wav,audio/aiff,audio/flac,audio/mpeg,audio/mp4,.wav,.aiff,.aif,.flac,.mp3,.m4a" className="sr-only" onChange={(event) => {
              const nextAudioFile = event.target.files?.[0] || null;
              const audioValidationError = audioUploadValidationError(nextAudioFile);
              if (audioValidationError) {
                setAudioFile(null);
                setCandidateShadowRequested(false);
                setError(audioValidationError);
                event.target.value = "";
                return;
              }
              setError("");
              setAudioFile(nextAudioFile);
              if (!nextAudioFile) setCandidateShadowRequested(false);
            }} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="title" className="text-[#f3f2eb]/78">Work title</Label>
              <Input id="title" data-testid={SCAN.titleInput} required disabled={submitting} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Unreleased demo" className="mt-2 border-white/10 bg-[#101b25] text-[#f3f2eb]" />
            </div>
            <div>
              <Label htmlFor="artist" className="text-[#f3f2eb]/78">Creator / artist</Label>
              <Input id="artist" data-testid={SCAN.artistInput} disabled={submitting} value={form.artist_name} onChange={(event) => setForm({ ...form, artist_name: event.target.value })} placeholder="Creator name" className="mt-2 border-white/10 bg-[#101b25] text-[#f3f2eb]" />
            </div>
          </div>

          {user?.role === "admin" && (
            <div className="rounded-xl border border-violet-300/20 bg-violet-300/[0.045] p-4">
              <label htmlFor="candidate-shadow" className="flex items-start gap-3">
                <input
                  id="candidate-shadow"
                  data-testid={SCAN.candidateShadowToggle}
                  type="checkbox"
                  checked={candidateShadowRequested}
                  disabled={submitting || !audioFile}
                  aria-describedby="candidate-shadow-detail"
                  onChange={(event) => setCandidateShadowRequested(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-violet-300"
                />
                <span>
                  <span className="block text-sm font-medium text-violet-100">Run V37 eight-channel research diagnostic</span>
                  <span id="candidate-shadow-detail" className="mt-1 block text-xs leading-5 text-[#f3f2eb]/70">
                    Administrator-only and audio-only. This adds retrieval time and stores diagnostic shadow evidence; it does not change the verdict, candidate ranking, provider calls, payment state or entitlement use.
                  </span>
                </span>
              </label>
              {!audioFile && <p className="mt-2 pl-7 text-[11px] text-violet-100/45">Choose an audio file to enable this control.</p>}
            </div>
          )}

          <details className="sc-upload-options">
            <summary>Optional lyrics and reference text</summary>
            <div className="pt-4">
            <Label htmlFor="lyrics" className="text-[#f3f2eb]/78">Lyrics</Label>
            <Textarea id="lyrics" data-testid={SCAN.lyricsInput} disabled={submitting} value={form.lyrics} onChange={(event) => setForm({ ...form, lyrics: event.target.value })} placeholder="Paste the submitted lyrics here…" className="mt-2 min-h-48 border-white/10 bg-[#101b25] text-[#f3f2eb]" />
            <p className="mt-2 text-xs text-[#f3f2eb]/70">Exact phrase overlap and Lyric Order Recovery compare available reference text. Lyrics are not automatically transcribed from audio.</p>
            <details className="mt-4 rounded-xl border border-white/10 p-4 text-[#f3f2eb]/75">
              <summary className="cursor-pointer text-sm">Compare with a reference lyric text</summary>
              <p className="mt-3 text-xs leading-5 text-[#f3f2eb]/70">Optional: supply a text you own or have permission to compare. This compares the two supplied texts; it does not search a catalogue. The full reference text is not stored; measurements and short exact-match evidence are retained with the scan. Rescans need the reference supplied again.</p>
              <Label htmlFor="reference-lyrics-title" className="mt-4 block text-sm">Reference title</Label>
              <Input id="reference-lyrics-title" disabled={submitting} maxLength={200} value={form.reference_lyrics_title} onChange={(event) => setForm({ ...form, reference_lyrics_title: event.target.value })} className="mt-2 border-white/10 bg-[#101b25]" />
              <Label htmlFor="reference-lyrics" className="mt-4 block text-sm">Reference lyrics</Label>
              <Textarea id="reference-lyrics" disabled={submitting} maxLength={20000} value={form.reference_lyrics} onChange={(event) => setForm({ ...form, reference_lyrics: event.target.value })} className="mt-2 min-h-36 border-white/10 bg-[#101b25]" />
              <label className="mt-3 flex items-start gap-3 text-xs leading-5"><input type="checkbox" disabled={submitting} checked={form.reference_lyrics_authorized} onChange={(event) => setForm({ ...form, reference_lyrics_authorized: event.target.checked })} className="mt-1" />I have permission to submit this reference text for comparison and retain the resulting evidence.</label>
            </details>
            </div>
          </details>

          <details className="sc-upload-options">
            <summary>Regional context · {form.region}</summary>
            <div className="pt-4">
            <Label className="text-[#f3f2eb]/78">Regional context</Label>
            <Select disabled={submitting} value={form.region} onValueChange={(region) => setForm({ ...form, region })}>
              <SelectTrigger data-testid={SCAN.regionSelect} className="mt-2 border-white/10 bg-[#101b25] text-[#f3f2eb]"><SelectValue /></SelectTrigger>
              <SelectContent className="sc-product-popover">{regions.map((region) => <SelectItem key={region.code} value={region.code}>{region.name} ({region.code})</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-2 text-xs text-[#f3f2eb]/70">This records context only. No fixed legal threshold or regional conclusion is applied.</p>
            </div>
          </details>

          {reconciliationNotice && <div role="status" className="flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100"><ShieldAlert className="h-5 w-5 shrink-0" />{reconciliationNotice}</div>}
          {error && <div role="alert" className="flex gap-3 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"><ShieldAlert className="h-5 w-5 shrink-0" />{error}</div>}

          <div className={`grid gap-3 ${submitting && !reconciling ? "sm:grid-cols-[1fr_auto]" : ""}`}>
            <Button type="submit" data-testid={SCAN.submitBtn} disabled={submitting || ambiguousOutcome} className="h-12 w-full bg-[#bcebd8] text-[#101216] hover:bg-[#bcebd8]/85">
              {submitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{reconciling ? "Checking stored status…" : "Analysis in progress…"}</>
                : ambiguousOutcome ? "Check dashboard before retrying" : "Start analysis"}
            </Button>
            {submitting && !reconciling && (
              <Button type="button" onClick={stopWaitingAndReconcile} variant="outline" className="h-12 border-white/15 bg-transparent text-[#f3f2eb] hover:bg-white/10">
                Cancel wait &amp; check status
              </Button>
            )}
            {ambiguousOutcome && (
              <Link to="/app"><Button type="button" variant="outline" className="h-12 w-full border-white/15 bg-transparent text-[#f3f2eb] hover:bg-white/10">Open dashboard</Button></Link>
            )}
          </div>
        </section>
      </form>

      <ScannerAnalyzer progress={scanProgress} />
      <ScanResultsOverview pending={submitting} />

      <aside className="sc-analysis-notes grid gap-5 md:grid-cols-2" aria-label="Storage and account details">
          <div className="rounded-lg border border-white/10 bg-[#141e2b] p-6">
            <FileText className="h-6 w-6 text-[#9DB8F0]" />
            <h2 className="mt-5 font-semibold text-[#f3f2eb]">What is stored</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#f3f2eb]/70">
              <li>• Evidence input provenance and hashes</li>
              <li>• Source and method availability</li>
              <li>• Candidate references and review context</li>
              <li>• Versioned limitations and interpretation</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#bcebd8]/20 bg-[#bcebd8]/5 p-6">
            <div className="text-[10px] uppercase tracking-widest text-[#bcebd8] font-mono-data">Entitlement use</div>
            <p className="mt-3 text-sm leading-6 text-[#f3f2eb]/70">A credit or monthly allocation is consumed only after analysis succeeds and the evidence record is stored.</p>
          </div>
      </aside>
      </div>
    </main>
  );
}
