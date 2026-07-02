import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCAN } from "@/constants/testIds";
import { UploadCloud, FileAudio2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

export default function NewScan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    artist_name: user?.name || "",
    lyrics: "",
    region: user?.region || "US",
    audio_url: "",
  });
  const [file, setFile] = useState(null);
  const [regions, setRegions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/regions").then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title required");
    if (!form.lyrics.trim() && !file && !form.audio_url.trim()) return toast.error("Provide lyrics, upload audio, or paste an audio URL");
    setSubmitting(true);
    try {
      let data;
      if (file || form.audio_url.trim()) {
        // multipart flow with ACRCloud fingerprinting
        const fd = new FormData();
        fd.append("title", form.title);
        fd.append("artist_name", form.artist_name);
        fd.append("lyrics", form.lyrics);
        fd.append("region", form.region);
        if (form.audio_url.trim()) fd.append("audio_url", form.audio_url.trim());
        if (file) fd.append("file", file);
        const res = await api.post("/scans/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        data = res.data;
      } else {
        const res = await api.post("/scans", form);
        data = res.data;
      }
      toast.success("Scan complete");
      navigate(`/scan/${data.id}`);
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      toast.error(msg);
      if (err.response?.status === 402) navigate("/pricing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">New scan</div>
      <h1 className="font-display text-5xl text-[#F0E9D6]">Run analysis.</h1>
      <p className="mt-3 max-w-xl text-[#F0E9D6]/65">Upload an audio file, paste lyrics, or both. Pick the jurisdiction you intend to release in.</p>

      <form onSubmit={onSubmit} className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-md border border-white/10 bg-[#24242C] p-6">
            <Label className="text-[#F0E9D6]/85">Track title</Label>
            <Input
              data-testid={SCAN.titleInput}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-2 border-white/10 bg-[#1C1C22] text-[#F0E9D6]"
              placeholder="e.g. Midnight Skyline"
            />
            <Label className="mt-5 block text-[#F0E9D6]/85">Artist name</Label>
            <Input
              data-testid={SCAN.artistInput}
              value={form.artist_name}
              onChange={(e) => setForm({ ...form, artist_name: e.target.value })}
              className="mt-2 border-white/10 bg-[#1C1C22] text-[#F0E9D6]"
              placeholder="Stage / legal name"
            />
          </div>

          <div className="rounded-md border border-white/10 bg-[#24242C] p-6">
            <Label className="text-[#F0E9D6]/85">Lyrics (optional)</Label>
            <Textarea
              data-testid={SCAN.lyricsInput}
              value={form.lyrics}
              onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
              rows={8}
              className="mt-2 border-white/10 bg-[#1C1C22] text-[#F0E9D6] font-mono-data text-sm"
              placeholder="Paste your full lyrics here…"
            />
            <p className="mt-2 text-xs text-[#F0E9D6]/50">We scan against millions of registered lyrics. Catches direct lifts and paraphrased hooks.</p>
          </div>

          <div className="rounded-md border border-white/10 bg-[#24242C] p-6">
            <Label className="text-[#F0E9D6]/85">Audio file (optional)</Label>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-white/15 bg-[#1C1C22] px-6 py-10 text-[#F0E9D6]/65 hover:border-white/30 hover:text-[#F0E9D6]">
              {file ? (
                <>
                  <FileAudio2 className="h-5 w-5 text-[#0047FF]" />
                  <span className="font-mono-data text-sm">{file.name} · {(file.size/1024/1024).toFixed(2)} MB</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6" />
                  <span>Click to upload (mp3, wav, m4a, flac)</span>
                </>
              )}
              <input
                data-testid={SCAN.audioFileInput}
                type="file"
                accept="audio/*"
                onChange={onFile}
                className="hidden"
              />
            </label>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <Label className="mt-4 block text-[#F0E9D6]/85">Paste direct audio URL</Label>
            <Input
              data-testid="scan-audio-url-input"
              value={form.audio_url}
              onChange={(e) => setForm({ ...form, audio_url: e.target.value })}
              className="mt-2 border-white/10 bg-[#1C1C22] text-[#F0E9D6] font-mono-data text-sm"
              placeholder="https://... direct .mp3/.wav link"
            />
            <p className="mt-2 text-xs text-[#F0E9D6]/50">Real fingerprinting via ACRCloud — matches against 90M+ licensed tracks with ISRC codes.</p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-md border border-white/10 bg-[#24242C] p-6">
            <Label className="text-[#F0E9D6]/85">Jurisdiction</Label>
            <div data-testid={SCAN.regionSelect} className="mt-2">
              <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                <SelectTrigger className="border-white/10 bg-[#1C1C22] text-[#F0E9D6]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72 border-white/10 bg-[#24242C] text-[#F0E9D6]">
                  {regions.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.code} — {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {regions.find((r) => r.code === form.region) && (
              <div className="mt-4 space-y-2 text-xs text-[#F0E9D6]/65">
                <div className="font-mono-data text-[#F0E9D6]/50">Doctrine</div>
                <div className="text-[#F0E9D6]">{regions.find((r) => r.code === form.region).doctrine}</div>
                <div className="font-mono-data text-[#F0E9D6]/50 mt-3">Lyric threshold</div>
                <div className="font-mono-data text-2xl text-[#F0E9D6]">{regions.find((r) => r.code === form.region).lyric_threshold}%</div>
                <div className="font-mono-data text-[#F0E9D6]/50 mt-3">Melody threshold</div>
                <div className="font-mono-data text-2xl text-[#F0E9D6]">{regions.find((r) => r.code === form.region).melody_threshold}%</div>
                <p className="mt-3 text-[#F0E9D6]/50">{regions.find((r) => r.code === form.region).notes}</p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            data-testid={SCAN.submitBtn}
            className="h-12 w-full rounded-md bg-[#D4FF00] text-[#1C1C22] btn-lift hover:bg-[#D4FF00]/85"
          >
            <ScanSearch className="mr-2 h-4 w-4" />
            {submitting ? "Analyzing…" : "Run scan"}
          </Button>

          <div className="rounded-md border border-blue-400/20 bg-blue-400/5 p-4 text-xs text-[#0047FF]/90">
            <strong className="font-mono-data uppercase tracking-widest text-[#0047FF]">Quota</strong>
            <p className="mt-1 text-blue-100/80">Used {user?.scans_used} scans on {user?.plan === "free" ? "Free (3 included)" : user?.plan?.replace("_", " ")}.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
