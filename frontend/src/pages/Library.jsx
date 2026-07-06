import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Play, Pause, RefreshCw, FileAudio, Loader2, Music2 } from "lucide-react";
import { toast } from "sonner";

const verdictColors = {
  CLEAR: "text-[#0047FF] border-emerald-400/40 bg-emerald-400/10",
  REVIEW: "text-[#F0E9D6] border-amber-400/40 bg-amber-400/10",
  VIOLATION: "text-[#D4FF00] border-red-400/40 bg-red-400/10",
};

function formatBytes(n) {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [audioLoading, setAudioLoading] = useState(null);
  const [rescanning, setRescanning] = useState(null);
  const audioRef = useRef(null);
  const blobCache = useRef({});

  useEffect(() => {
    api.get("/library").then((r) => setItems(r.data)).catch((e) => {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }).finally(() => setLoading(false));
    const cache = blobCache.current;
    return () => {
      if (audioRef.current) audioRef.current.pause();
      Object.values(cache).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const togglePlay = async (item) => {
    if (playingId === item.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    setAudioLoading(item.id);
    try {
      let url = blobCache.current[item.id];
      if (!url) {
        const res = await api.get(`/scans/${item.id}/audio`, { responseType: "blob" });
        url = URL.createObjectURL(res.data);
        blobCache.current[item.id] = url;
      }
      const audio = new Audio(url);
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      await audio.play();
      setPlayingId(item.id);
    } catch (e) {
      toast.error("Could not play audio");
    } finally {
      setAudioLoading(null);
    }
  };

  const onRescan = async (item) => {
    setRescanning(item.id);
    try {
      const { data } = await api.post(`/scans/${item.id}/rescan`, {});
      toast.success("Re-scan complete");
      navigate(`/scan/${data.id}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setRescanning(null);
    }
  };

  const isFree = user?.plan === "free" && user?.role !== "admin";

  return (
    <div className="mx-auto max-w-7xl px-6 py-12" data-testid="library-page">
      <div className="mb-10">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-[#F0E9D6]/50 font-mono-data">Audio vault</div>
        <h1 className="font-display text-5xl text-[#F0E9D6]">My Library</h1>
        <p className="mt-3 max-w-xl text-[#F0E9D6]/65">Every track you've scanned on a Pro plan is stored here — replay it, or re-scan it against the latest catalogs and a different jurisdiction.</p>
      </div>

      {loading ? (
        <div className="rounded-md border border-white/10 bg-[#24242C] p-12 text-center text-[#F0E9D6]/50 font-mono-data text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div data-testid="library-empty-state" className="rounded-md border border-dashed border-white/10 bg-[#24242C] p-16 text-center">
          <Music2 className="mx-auto h-10 w-10 text-[#F0E9D6]/35" />
          <h3 className="mt-4 font-display text-3xl text-[#F0E9D6]">{isFree ? "Your vault is locked" : "No stored tracks yet"}</h3>
          <p className="mt-2 text-[#F0E9D6]/65">
            {isFree
              ? "Audio storage is a Pro feature. Upgrade and every audio scan is permanently archived for playback and re-scanning."
              : "Run an audio scan and it will appear here automatically."}
          </p>
          <Link to={isFree ? "/pricing" : "/scan/new"} className="mt-6 inline-block">
            <Button data-testid="library-empty-cta" className="h-11 rounded-md bg-[#D4FF00] px-6 text-[#1C1C22] btn-lift hover:bg-[#D4FF00]/85">
              {isFree ? "See Pro plans" : "Run an audio scan"}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const verdict = item.result?.verdict || "REVIEW";
            return (
              <div key={item.id} data-testid="library-track-card" className="grid grid-cols-12 items-center gap-4 rounded-md border border-white/10 bg-[#24242C] p-5">
                <div className="col-span-12 sm:col-span-1">
                  <Button
                    data-testid="library-play-btn"
                    onClick={() => togglePlay(item)}
                    variant="outline"
                    className="h-11 w-11 rounded-full border-[#0047FF]/40 bg-transparent p-0 text-[#F0E9D6] hover:bg-[#0047FF]/15 hover:text-[#F0E9D6]"
                  >
                    {audioLoading === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : playingId === item.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <Link to={`/scan/${item.id}`} className="font-display text-xl text-[#F0E9D6] hover:text-[#D4FF00]">{item.title}</Link>
                  <div className="flex items-center gap-2 text-xs text-[#F0E9D6]/50 font-mono-data">
                    <FileAudio className="h-3 w-3" /> {item.audio_filename || "audio"} · {formatBytes(item.audio_size_bytes)}
                  </div>
                </div>
                <div className="col-span-4 sm:col-span-2 font-mono-data text-2xl text-[#F0E9D6]">
                  {item.result?.overall_score ?? 0}<span className="text-sm text-[#F0E9D6]/50">%</span>
                </div>
                <div className="col-span-8 sm:col-span-2">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-mono-data uppercase tracking-widest ${verdictColors[verdict] || verdictColors.REVIEW}`}>{verdict}</span>
                </div>
                <div className="col-span-12 sm:col-span-3 flex justify-end gap-2">
                  <Link to={`/scan/${item.id}`}>
                    <Button variant="ghost" className="text-[#F0E9D6]/85 hover:bg-white/10 hover:text-[#F0E9D6]">Report</Button>
                  </Link>
                  <Button
                    data-testid="library-rescan-btn"
                    onClick={() => onRescan(item)}
                    disabled={rescanning === item.id}
                    variant="outline"
                    className="border-[#D4FF00]/40 bg-transparent text-[#D4FF00] hover:bg-[#D4FF00]/10 hover:text-[#D4FF00]"
                  >
                    {rescanning === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {rescanning === item.id ? "Scanning…" : "Re-scan"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
