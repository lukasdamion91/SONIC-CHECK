import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { NAV } from "@/constants/testIds";
import { LogOut, Radio } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const linkClass = (path) =>
    `text-sm transition-colors ${pathname === path ? "text-white" : "text-zinc-400 hover:text-white"}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" data-testid={NAV.logo} className="flex items-center gap-2 text-white">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-white text-black">
            <Radio className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl tracking-tighter">SonicCheck</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {user ? (
            <>
              <Link to="/dashboard" data-testid={NAV.dashboardLink} className={linkClass("/dashboard")}>Dashboard</Link>
              <Link to="/scan/new" data-testid={NAV.newScanLink} className={linkClass("/scan/new")}>New Scan</Link>
              <Link to="/pricing" data-testid={NAV.pricingLink} className={linkClass("/pricing")}>Pricing</Link>
            </>
          ) : (
            <>
              <Link to="/pricing" data-testid={NAV.pricingLink} className={linkClass("/pricing")}>Pricing</Link>
              <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white">How it works</a>
              <a href="#regions" className="text-sm text-zinc-400 hover:text-white">Jurisdictions</a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-xs text-zinc-400 sm:inline font-mono-data">{user.email}</span>
              <Button
                data-testid={NAV.logoutBtn}
                onClick={handleLogout}
                variant="ghost"
                className="text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid={NAV.loginLink}>
                <Button variant="ghost" className="text-zinc-300 hover:bg-white/10 hover:text-white">Sign in</Button>
              </Link>
              <Link to="/register" data-testid={NAV.signupLink}>
                <Button className="bg-white text-black btn-lift hover:bg-zinc-200">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
