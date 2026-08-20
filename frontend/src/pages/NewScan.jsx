import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileAudio, FileText, Loader2, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCAN } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";

export default function NewScan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [regions, setRegions] = useState([]);
  const [form, setForm] = useState({ title: "", artist_name: user?.name || "", lyrics: "", region: user?.region || "AU" });
  const [audioFile, setAudioFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

    setSubmitting(true);
    try {
      const { data } = await api.post("/scans/upload", payload);
      toast.success("Evidence record created");
      navigate(`/app/scans/${data.id}`);
    } catch (requestError) {
      const message = formatApiErrorDetail(requestError?.response?.data?.detail);
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="eyebrow">New evidence screen</div>
        <h1 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-6xl">Submit private material.</h1>
        <p className="mt-5 leading-7 text-[#F0E9D6]/62">Provide decoded audio, lyrics or both. SONIC CHECK will preserve each available channel as method-labelled candidate evidence.</p>
      </div>

      <form onSubmit={submit} className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.42fr]">
        <div className="space-y-6 rounded-2xl border border-white/10 bg-[#202027] p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="title" className="text-[#F0E9D6]/78">Work title</Label>
              <Input id="title" data-testid={SCAN.titleInput} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Unreleased demo" className="mt-2 border-white/10 bg-[#17171C] text-[#F0E9D6]" />
            </div>
            <div>
              <Label htmlFor="artist" className="text-[#F0E9D6]/78">Creator / artist</Label>
              <Input id="artist" data-testid={SCAN.artistInput} value={form.artist_name} onChange={(event) => setForm({ ...form, artist_name: event.target.value })} placeholder="Creator name" className="mt-2 border-white/10 bg-[#17171C] text-[#F0E9D6]" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="audio" className="text-[#F0E9D6]/78">Audio file</Label>
              <span className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/38 font-mono-data">WAV · AIFF · FLAC · MP3 · M4A</span>
            </div>
            <label htmlFor="audio" className="mt-2 flex min-h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#17171C] p-6 text-center hover:border-[#9DB8F0]/45">
              <div>
                {audioFile ? <FileAudio className="mx-auto h-7 w-7 text-[#D4FF00]" /> : <Upload className="mx-auto h-7 w-7 text-[#9DB8F0]" />}
                <div className="mt-3 text-sm text-[#F0E9D6]">{audioFile ? audioFile.name : "Choose an audio file"}</div>
                <div className="mt-1 text-xs text-[#F0E9D6]/42">The API validates file size and decodability before a credit is consumed.</div>
              </div>
            </label>
            <input id="audio" data-testid={SCAN.audioFileInput} type="file" accept="audio/wav,audio/x-wav,audio/aiff,audio/flac,audio/mpeg,audio/mp4,.wav,.aiff,.aif,.flac,.mp3,.m4a" className="sr-only" onChange={(event) => setAudioFile(event.target.files?.[0] || null)} />
          </div>

          <div>
            <Label htmlFor="lyrics" className="text-[#F0E9D6]/78">Lyrics</Label>
            <Textarea id="lyrics" data-testid={SCAN.lyricsInput} value={form.lyrics} onChange={(event) => setForm({ ...form, lyrics: event.target.value })} placeholder="Paste the submitted lyrics here…" className="mt-2 min-h-48 border-white/10 bg-[#17171C] text-[#F0E9D6]" />
            <p className="mt-2 text-xs text-[#F0E9D6]/42">The lyric channel reports distinctive exact phrase overlap with review context; it does not infer ownership.</p>
          </div>

          <div>
            <Label className="text-[#F0E9D6]/78">Regional context</Label>
            <Select value={form.region} onValueChange={(region) => setForm({ ...form, region })}>
              <SelectTrigger data-testid={SCAN.regionSelect} className="mt-2 border-white/10 bg-[#17171C] text-[#F0E9D6]"><SelectValue /></SelectTrigger>
              <SelectContent>{regions.map((region) => <SelectItem key={region.code} value={region.code}>{region.name} ({region.code})</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-2 text-xs text-[#F0E9D6]/42">This records context only. No fixed legal threshold or regional conclusion is applied.</p>
          </div>

          {error && <div className="flex gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-200"><ShieldAlert className="h-5 w-5 shrink-0" />{error}</div>}

          <Button type="submit" data-testid={SCAN.submitBtn} disabled={submitting} className="h-12 w-full bg-[#D4FF00] text-[#1C1C22] hover:bg-[#D4FF00]/85">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Screening evidence…</> : "Start evidence screen"}
          </Button>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-[#24242C] p-6">
            <FileText className="h-6 w-6 text-[#9DB8F0]" />
            <h2 className="mt-5 font-semibold text-[#F0E9D6]">What is stored</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#F0E9D6]/56">
              <li>• Evidence input provenance and hashes</li>
              <li>• Source and method availability</li>
              <li>• Candidate references and review context</li>
              <li>• Versioned limitations and interpretation</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-6">
            <div className="text-[10px] uppercase tracking-widest text-[#D4FF00] font-mono-data">Entitlement use</div>
            <p className="mt-3 text-sm leading-6 text-[#F0E9D6]/65">A credit or monthly allocation is consumed only after analysis succeeds and the evidence record is stored.</p>
          </div>
        </aside>
      </form>
    </main>
  );
}
