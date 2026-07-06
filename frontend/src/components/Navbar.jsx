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
    `text-sm transition-colors ${pathname === path ? "text-[#F0E9D6]" : "text-[#F0E9D6]/65 hover:text-[#F0E9D6]"}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" data-testid={NAV.logo} className="flex items-center gap-2 text-[#F0E9D6]">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[#D4FF00] text-[#1C1C22]">
            <Radio className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl tracking-tighter">SonicCheck</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {user ? (
            <>
              <Link to="/dashboard" data-testid={NAV.dashboardLink} className={linkClass("/dashboard")}>Dashboard</Link>
              <Link to="/scan/new" data-testid={NAV.newScanLink} className={linkClass("/scan/new")}>New Scan</Link>
              <Link to="/library" data-testid="nav-library-link" className={linkClass("/library")}>Library</Link>
              <Link to="/pricing" data-testid={NAV.pricingLink} className={linkClass("/pricing")}>Pricing</Link>
            </>
          ) : (
            <>
              <Link to="/pricing" data-testid={NAV.pricingLink} className={linkClass("/pricing")}>Pricing</Link>
              <a href="#how-it-works" className="text-sm text-[#F0E9D6]/65 hover:text-[#F0E9D6]">How it works</a>
              <a href="#regions" className="text-sm text-[#F0E9D6]/65 hover:text-[#F0E9D6]">Jurisdictions</a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-xs text-[#F0E9D6]/65 sm:inline font-mono-data">{user.email}</span>
              <Button
                data-testid={NAV.logoutBtn}
                onClick={handleLogout}
                variant="ghost"
                className="text-[#F0E9D6]/85 hover:bg-white/10 hover:text-[#F0E9D6]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid={NAV.loginLink}>
                <Button variant="ghost" className="text-[#F0E9D6]/85 hover:bg-white/10 hover:text-[#F0E9D6]">Sign in</Button>
              </Link>
              <Link to="/register" data-testid={NAV.signupLink}>
                <Button className="bg-[#D4FF00] text-[#1C1C22] btn-lift hover:bg-[#D4FF00]/85">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
