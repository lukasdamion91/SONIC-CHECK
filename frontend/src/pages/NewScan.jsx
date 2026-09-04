import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileAudio, FileText, Loader2, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import ChromaticText from "@/components/ChromaticText";
import ScannerAnalyzer from "@/components/ScannerAnalyzer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCAN } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
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
  const [form, setForm] = useState({ title: "", artist_name: user?.name || "", lyrics: "", region: user?.region || "AU" });
  const [audioFile, setAudioFile] = useState(null);
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
          ? "The maximum upload-response wait ended. SonicCheck stopped waiting for that response and is checking the owner-scoped durable record. Do not start another screen yet."
          : reason === "user_stop"
            ? "SonicCheck stopped waiting for the upload response and is checking the owner-scoped durable record. Do not start another screen yet."
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
        });

        if (report.state === "completed") {
          // The durable progress record recovers a successful scan even if
          // the long-running upload POST response is lost at the browser.
          if (!activePoll.recovery.handleProgress(report)) completeSubmission(report.scanId);
          return;
        }
        if (report.state === "failed") {
          const message = report.errorCode
            ? `The server stopped this evidence screen (${report.errorCode}).`
            : "The server stopped this evidence screen before a result was stored.";
          if (!activePoll.recovery.handleProgress(report, message)) failSubmission(message, report.state);
          return;
        }

        schedule(report.retryAfterMs);
      } catch (pollError) {
        if (activePoll.controller.signal.aborted) return;
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
      setError("Check the dashboard for the prior submission before starting another evidence screen.");
      return;
    }
    if (!form.lyrics.trim() && !audioFile) {
      setError("Add an audio file, lyrics, or both before starting the screen.");
      return;
    }

    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("artist_name", form.artist_name.trim());
    payload.append("lyrics", form.lyrics);
    payload.append("region", form.region);
    if (audioFile) payload.append("file", audioFile);
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
      <div className="relative z-10 max-w-4xl">
        <div className="eyebrow">New evidence screen</div>
        <h1 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-6xl">
          Submit <ChromaticText>private material.</ChromaticText>
        </h1>
        <p className="mt-5 leading-7 text-[#F0E9D6]/62">Provide decoded audio, lyrics or both. SONIC CHECK will preserve each available channel as method-labelled candidate evidence.</p>
      </div>

      <form onSubmit={submit} aria-busy={submitting} className="relative z-10 mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.62fr)] lg:items-start">
        <div className="scan-intake-panel space-y-6 rounded-xl border border-white/10 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="title" className="text-[#F0E9D6]/78">Work title</Label>
              <Input id="title" data-testid={SCAN.titleInput} required disabled={submitting} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Unreleased demo" className="mt-2 border-white/10 bg-[#17171C] text-[#F0E9D6]" />
            </div>
            <div>
              <Label htmlFor="artist" className="text-[#F0E9D6]/78">Creator / artist</Label>
              <Input id="artist" data-testid={SCAN.artistInput} disabled={submitting} value={form.artist_name} onChange={(event) => setForm({ ...form, artist_name: event.target.value })} placeholder="Creator name" className="mt-2 border-white/10 bg-[#17171C] text-[#F0E9D6]" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="audio" className="text-[#F0E9D6]/78">Audio file</Label>
              <span className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/38 font-mono-data">WAV · AIFF · FLAC · MP3 · M4A</span>
            </div>
            <label htmlFor="audio" data-disabled={submitting ? "true" : "false"} className="audio-drop-zone mt-2 flex min-h-32 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#17171C] p-6 text-center hover:border-[#9DB8F0]/45">
              <div>
                {audioFile ? <FileAudio className="mx-auto h-7 w-7 text-[#D4FF00]" /> : <Upload className="mx-auto h-7 w-7 text-[#9DB8F0]" />}
                <div className="mt-3 text-sm text-[#F0E9D6]">{audioFile ? audioFile.name : "Choose an audio file"}</div>
                <div className="mt-1 text-xs text-[#F0E9D6]/42">The API validates file size and decodability before a credit is consumed.</div>
              </div>
            </label>
            <input id="audio" data-testid={SCAN.audioFileInput} disabled={submitting} type="file" accept="audio/wav,audio/x-wav,audio/aiff,audio/flac,audio/mpeg,audio/mp4,.wav,.aiff,.aif,.flac,.mp3,.m4a" className="sr-only" onChange={(event) => setAudioFile(event.target.files?.[0] || null)} />
          </div>

          <div>
            <Label htmlFor="lyrics" className="text-[#F0E9D6]/78">Lyrics</Label>
            <Textarea id="lyrics" data-testid={SCAN.lyricsInput} disabled={submitting} value={form.lyrics} onChange={(event) => setForm({ ...form, lyrics: event.target.value })} placeholder="Paste the submitted lyrics here…" className="mt-2 min-h-48 border-white/10 bg-[#17171C] text-[#F0E9D6]" />
            <p className="mt-2 text-xs text-[#F0E9D6]/42">The lyric channel reports distinctive exact phrase overlap with review context; it does not infer ownership.</p>
          </div>

          <div>
            <Label className="text-[#F0E9D6]/78">Regional context</Label>
            <Select disabled={submitting} value={form.region} onValueChange={(region) => setForm({ ...form, region })}>
              <SelectTrigger data-testid={SCAN.regionSelect} className="mt-2 border-white/10 bg-[#17171C] text-[#F0E9D6]"><SelectValue /></SelectTrigger>
              <SelectContent>{regions.map((region) => <SelectItem key={region.code} value={region.code}>{region.name} ({region.code})</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-2 text-xs text-[#F0E9D6]/42">This records context only. No fixed legal threshold or regional conclusion is applied.</p>
          </div>

          {reconciliationNotice && <div role="status" className="flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100"><ShieldAlert className="h-5 w-5 shrink-0" />{reconciliationNotice}</div>}
          {error && <div role="alert" className="flex gap-3 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"><ShieldAlert className="h-5 w-5 shrink-0" />{error}</div>}

          <div className={`grid gap-3 ${submitting && !reconciling ? "sm:grid-cols-[1fr_auto]" : ""}`}>
            <Button type="submit" data-testid={SCAN.submitBtn} disabled={submitting || ambiguousOutcome} className="h-12 w-full bg-[#D4FF00] text-[#1C1C22] hover:bg-[#D4FF00]/85">
              {submitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{reconciling ? "Checking stored status…" : "Evidence screen in progress…"}</>
                : ambiguousOutcome ? "Check dashboard before another screen" : "Start evidence screen"}
            </Button>
            {submitting && !reconciling && (
              <Button type="button" onClick={stopWaitingAndReconcile} variant="outline" className="h-12 border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">
                Cancel wait &amp; check status
              </Button>
            )}
            {ambiguousOutcome && (
              <Link to="/app"><Button type="button" variant="outline" className="h-12 w-full border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">Open dashboard</Button></Link>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <ScannerAnalyzer progress={scanProgress} />
          <div className="rounded-lg border border-white/10 bg-[#24242C] p-6">
            <FileText className="h-6 w-6 text-[#9DB8F0]" />
            <h2 className="mt-5 font-semibold text-[#F0E9D6]">What is stored</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#F0E9D6]/56">
              <li>• Evidence input provenance and hashes</li>
              <li>• Source and method availability</li>
              <li>• Candidate references and review context</li>
              <li>• Versioned limitations and interpretation</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-6">
            <div className="text-[10px] uppercase tracking-widest text-[#D4FF00] font-mono-data">Entitlement use</div>
            <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/65">A credit or monthly allocation is consumed only after analysis succeeds and the evidence record is stored.</p>
          </div>
        </aside>
      </form>
    </main>
  );
}
