import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGIN } from "@/constants/testIds";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login, formatApiErrorDetail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
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
        <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500 font-mono-data">Sign in</div>
        <h1 className="font-display text-6xl text-white">Welcome<br/>back.</h1>
        <p className="mt-6 max-w-md text-zinc-400">Open your studio dashboard, review past scans, and run new ones against the global reference catalog.</p>
      </div>
      <div className="rounded-md border border-white/10 bg-[#121216] p-8 lg:p-10">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input
              id="email"
              type="email"
              data-testid={LOGIN.emailInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 border-white/10 bg-[#0A0A0E] text-white placeholder:text-zinc-600"
              placeholder="you@studio.com"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-zinc-300">Password</Label>
            <Input
              id="password"
              type="password"
              data-testid={LOGIN.passwordInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 border-white/10 bg-[#0A0A0E] text-white"
              placeholder="••••••••"
            />
          </div>
          {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
          <Button
            type="submit"
            disabled={loading}
            data-testid={LOGIN.submitButton}
            className="h-11 w-full rounded-md bg-white text-black btn-lift hover:bg-zinc-200"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <div className="text-center text-sm text-zinc-400">
            New to SonicCheck?{" "}
            <Link to="/register" data-testid={LOGIN.registerLink} className="text-white underline-offset-4 hover:underline">Create an account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
