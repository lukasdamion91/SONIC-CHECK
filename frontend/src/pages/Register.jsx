import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGISTER } from "@/constants/testIds";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const { register, formatApiErrorDetail } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", role: "artist" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, role: form.role });
      toast.success("Account created — welcome to SonicCheck");
      navigate("/dashboard");
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-24">
      <div className="hidden lg:block">
        <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Create account</div>
        <h1 className="font-display text-6xl text-white">Protect every<br/>release.</h1>
        <p className="mt-6 max-w-md text-zinc-400">Free tier includes 3 full scans, regional verdicts, and lyric analysis. Upgrade anytime to unlock stem-level audio fingerprinting and priority queueing.</p>
      </div>
      <div className="rounded-md border border-white/10 bg-[#121216] p-8 lg:p-10">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="text-zinc-300">Name</Label>
            <Input
              data-testid={REGISTER.nameInput}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="mt-2 border-white/10 bg-[#0A0A0E] text-white"
              placeholder="Your stage / legal name"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="mt-2 border-white/10 bg-[#0A0A0E] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#121216] text-white">
                <SelectItem value="artist">Recording Artist</SelectItem>
                <SelectItem value="producer">Music Producer</SelectItem>
                <SelectItem value="student">Music Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-zinc-300">Email</Label>
            <Input
              type="email"
              data-testid={REGISTER.emailInput}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="mt-2 border-white/10 bg-[#0A0A0E] text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-300">Password</Label>
              <Input
                type="password"
                data-testid={REGISTER.passwordInput}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="mt-2 border-white/10 bg-[#0A0A0E] text-white"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Confirm</Label>
              <Input
                type="password"
                data-testid={REGISTER.passwordConfirmInput}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
                className="mt-2 border-white/10 bg-[#0A0A0E] text-white"
              />
            </div>
          </div>
          {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
          <Button
            type="submit"
            disabled={loading}
            data-testid={REGISTER.submitButton}
            className="h-11 w-full rounded-md bg-white text-black btn-lift hover:bg-zinc-200"
          >
            {loading ? "Creating…" : "Create account"}
          </Button>
          <div className="text-center text-sm text-zinc-400">
            Already have an account?{" "}
            <Link to="/login" data-testid={REGISTER.loginLink} className="text-white underline-offset-4 hover:underline">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
