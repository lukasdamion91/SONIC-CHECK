import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { NAV } from "@/constants/testIds";

const asset = (path) => `${process.env.PUBLIC_URL || ""}${path}`;

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
  const active = (path) =>
    `text-sm transition-colors ${pathname === path ? "text-[#F0E9D6]" : "text-[#F0E9D6]/60 hover:text-[#F0E9D6]"}`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#111116]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
        <Link to={user ? "/app" : "/"} data-testid={NAV.logo} className="flex items-center gap-3">
          <img src={asset("/brand/logo-icon.png")} alt="" className="h-9 w-9 object-contain" />
          <img src={asset("/brand/logo-wordmark.png")} alt="SonicCheck" className="h-5 w-auto object-contain" />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
          {user ? (
            <>
              <Link to="/app" data-testid={NAV.dashboardLink} className={active("/app")}>Dashboard</Link>
              <Link to="/app/scan/new" data-testid={NAV.newScanLink} className={active("/app/scan/new")}>New screen</Link>
              <Link to="/app/library" className={active("/app/library")}>Library</Link>
              <Link to="/app/billing" data-testid={NAV.pricingLink} className={active("/app/billing")}>Plan &amp; billing</Link>
            </>
          ) : (
            <>
              <a href={`${process.env.PUBLIC_URL || ""}/#method`} className="text-sm text-[#F0E9D6]/60 hover:text-[#F0E9D6]">Method</a>
              <a href={`${process.env.PUBLIC_URL || ""}/#catalogue`} className="text-sm text-[#F0E9D6]/60 hover:text-[#F0E9D6]">Catalogue</a>
              <a href={`${process.env.PUBLIC_URL || ""}/#pricing`} className="text-sm text-[#F0E9D6]/60 hover:text-[#F0E9D6]">Pricing</a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <span className="hidden max-w-48 truncate text-xs text-[#F0E9D6]/55 md:inline font-mono-data">{user.email}</span>
              <Button data-testid={NAV.logoutBtn} onClick={handleLogout} variant="ghost" className="text-[#F0E9D6]/80 hover:bg-white/10 hover:text-[#F0E9D6]">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid={NAV.loginLink}>
                <Button variant="ghost" disabled={loading} className="text-[#F0E9D6]/85 hover:bg-white/10">Log in</Button>
              </Link>
              <Link to="/join" data-testid={NAV.signupLink}>
                <Button disabled={loading} className="bg-[#D4FF00] text-[#1C1C22] hover:bg-[#D4FF00]/85">Join</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
