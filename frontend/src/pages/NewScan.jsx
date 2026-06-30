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
    audio_filename: null,
    audio_size_bytes: 0,
  });
  const [regions, setRegions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/regions").then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setForm((p) => ({ ...p, audio_filename: f.name, audio_size_bytes: f.size }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title required");
    if (!form.lyrics.trim() && !form.audio_filename) return toast.error("Provide lyrics or upload an audio file");
    setSubmitting(true);
    try {
      const { data } = await api.post("/scans", form);
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
      <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">New scan</div>
      <h1 className="font-display text-5xl text-white">Run analysis.</h1>
      <p className="mt-3 max-w-xl text-zinc-400">Upload an audio file, paste lyrics, or both. Pick the jurisdiction you intend to release in.</p>

      <form onSubmit={onSubmit} className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-md border border-white/10 bg-[#121216] p-6">
            <Label className="text-zinc-300">Track title</Label>
            <Input
              data-testid={SCAN.titleInput}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-2 border-white/10 bg-[#0A0A0E] text-white"
              placeholder="e.g. Midnight Skyline"
            />
            <Label className="mt-5 block text-zinc-300">Artist name</Label>
            <Input
              data-testid={SCAN.artistInput}
              value={form.artist_name}
              onChange={(e) => setForm({ ...form, artist_name: e.target.value })}
              className="mt-2 border-white/10 bg-[#0A0A0E] text-white"
              placeholder="Stage / legal name"
            />
          </div>

          <div className="rounded-md border border-white/10 bg-[#121216] p-6">
            <Label className="text-zinc-300">Lyrics (optional)</Label>
            <Textarea
              data-testid={SCAN.lyricsInput}
              value={form.lyrics}
              onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
              rows={8}
              className="mt-2 border-white/10 bg-[#0A0A0E] text-white font-mono-data text-sm"
              placeholder="Paste your full lyrics here…"
            />
            <p className="mt-2 text-xs text-zinc-500">We scan against millions of registered lyrics. Catches direct lifts and paraphrased hooks.</p>
          </div>

          <div className="rounded-md border border-white/10 bg-[#121216] p-6">
            <Label className="text-zinc-300">Audio file (optional)</Label>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-white/15 bg-[#0A0A0E] px-6 py-10 text-zinc-400 hover:border-white/30 hover:text-white">
              {form.audio_filename ? (
                <>
                  <FileAudio2 className="h-5 w-5 text-blue-400" />
                  <span className="font-mono-data text-sm">{form.audio_filename} · {(form.audio_size_bytes/1024/1024).toFixed(2)} MB</span>
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
            <p className="mt-2 text-xs text-zinc-500">In MVP we analyze metadata + filename. Stem-level fingerprinting available on Producer Pro.</p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-md border border-white/10 bg-[#121216] p-6">
            <Label className="text-zinc-300">Jurisdiction</Label>
            <div data-testid={SCAN.regionSelect} className="mt-2">
              <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                <SelectTrigger className="border-white/10 bg-[#0A0A0E] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72 border-white/10 bg-[#121216] text-white">
                  {regions.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.code} — {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {regions.find((r) => r.code === form.region) && (
              <div className="mt-4 space-y-2 text-xs text-zinc-400">
                <div className="font-mono-data text-zinc-500">Doctrine</div>
                <div className="text-white">{regions.find((r) => r.code === form.region).doctrine}</div>
                <div className="font-mono-data text-zinc-500 mt-3">Lyric threshold</div>
                <div className="font-mono-data text-2xl text-white">{regions.find((r) => r.code === form.region).lyric_threshold}%</div>
                <div className="font-mono-data text-zinc-500 mt-3">Melody threshold</div>
                <div className="font-mono-data text-2xl text-white">{regions.find((r) => r.code === form.region).melody_threshold}%</div>
                <p className="mt-3 text-zinc-500">{regions.find((r) => r.code === form.region).notes}</p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            data-testid={SCAN.submitBtn}
            className="h-12 w-full rounded-md bg-white text-black btn-lift hover:bg-zinc-200"
          >
            <ScanSearch className="mr-2 h-4 w-4" />
            {submitting ? "Analyzing…" : "Run scan"}
          </Button>

          <div className="rounded-md border border-blue-400/20 bg-blue-400/5 p-4 text-xs text-blue-200">
            <strong className="font-mono-data uppercase tracking-widest text-blue-300">Quota</strong>
            <p className="mt-1 text-blue-100/80">Used {user?.scans_used} scans on {user?.plan === "free" ? "Free (3 included)" : user?.plan?.replace("_", " ")}.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
