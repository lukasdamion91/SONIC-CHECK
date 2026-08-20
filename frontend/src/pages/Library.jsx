import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileAudio, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";

const labels = {
  REVIEW_REQUIRED: "Candidate evidence",
  NO_CANDIDATE_IDENTIFIED: "No candidate identified",
  INCONCLUSIVE: "Inconclusive",
};

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [audioUrls, setAudioUrls] = useState({});
  const audioUrlsRef = useRef({});

  useEffect(() => {
    api.get("/library")
      .then(({ data }) => setItems(data))
      .catch((requestError) => setError(formatApiErrorDetail(requestError?.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => () => {
    Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const loadAudio = async (item) => {
    setAction(`audio:${item.id}`);
    try {
      const response = await api.get(`/scans/${item.id}/audio`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      setAudioUrls((current) => ({ ...current, [item.id]: url }));
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
    } finally {
      setAction("");
    }
  };

  const rescan = async (item) => {
    setAction(`rescan:${item.id}`);
    try {
      const { data } = await api.post(`/scans/${item.id}/rescan`, { region: user?.region || item.region || "AU" });
      toast.success("New evidence record created");
      navigate(`/app/scans/${data.id}`);
    } catch (requestError) {
      toast.error(formatApiErrorDetail(requestError?.response?.data?.detail));
      setAction("");
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="eyebrow">Private library</div>
        <h1 className="mt-4 font-display text-5xl text-[#F0E9D6] sm:text-6xl">Stored source material.</h1>
        <p className="mt-5 leading-7 text-[#F0E9D6]/62">Audio appears here only when the account entitlement permits private retention and the upload was stored successfully.</p>
      </div>

      {loading ? (
        <div className="grid min-h-80 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#F0E9D6]/45" /></div>
      ) : error ? (
        <div className="mt-10 rounded-xl border border-red-400/20 bg-red-400/5 p-5 text-red-200">{error}</div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 p-12 text-center">
          <FileAudio className="mx-auto h-9 w-9 text-[#9DB8F0]" />
          <h2 className="mt-5 text-xl font-semibold text-[#F0E9D6]">No retained audio yet.</h2>
          <p className="mt-2 text-sm text-[#F0E9D6]/52">Start an entitled audio evidence screen to populate the library.</p>
          <Link to="/app/scan/new"><Button className="mt-6 bg-[#D4FF00] text-[#1C1C22] hover:bg-[#D4FF00]/85">New evidence screen</Button></Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-[#202027] p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#17171C]"><FileAudio className="h-5 w-5 text-[#9DB8F0]" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-[#F0E9D6]">{item.title}</h2>
                  <div className="mt-1 truncate text-xs text-[#F0E9D6]/42">{item.audio_filename} · {new Date(item.created_at).toLocaleDateString("en-AU")}</div>
                  <div className="mt-3 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[9px] uppercase tracking-widest text-[#F0E9D6]/52 font-mono-data">{labels[item.result?.screening_status] || "Legacy record"}</div>
                </div>
              </div>

              {audioUrls[item.id] && <audio src={audioUrls[item.id]} controls className="mt-5 w-full" preload="metadata">Your browser does not support audio playback.</audio>}

              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                <Button onClick={() => loadAudio(item)} disabled={Boolean(action) || Boolean(audioUrls[item.id])} variant="outline" className="border-white/15 bg-transparent text-[#F0E9D6] hover:bg-white/10">
                  {action === `audio:${item.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}{audioUrls[item.id] ? "Audio loaded" : "Load audio"}
                </Button>
                <Button onClick={() => rescan(item)} disabled={Boolean(action)} variant="outline" className="border-[#D4FF00]/25 bg-transparent text-[#D4FF00] hover:bg-[#D4FF00]/5">
                  {action === `rescan:${item.id}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Re-screen
                </Button>
                <Link to={`/app/scans/${item.id}`}><Button variant="ghost" className="text-[#F0E9D6]/65 hover:bg-white/10">Open record</Button></Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs leading-5 text-[#F0E9D6]/40">Re-screening creates a new versioned evidence record and consumes the applicable account entitlement only after successful storage.</p>
    </main>
  );
}
