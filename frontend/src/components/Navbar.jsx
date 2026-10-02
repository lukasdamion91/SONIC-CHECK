import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NAV } from "@/constants/testIds";
import "@/pages/Resonance.css";

const asset = (path) => `${process.env.PUBLIC_URL || ""}${path}`;

export default function Navbar() {
  const { user, clerkUser, isSignedIn, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const menuRef = useRef(null);

  useEffect(() => {
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname, hash]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  const publicLinks = (
    <>
      <a href={`${process.env.PUBLIC_URL || ""}/#sc4-about`} onClick={closeMenu}>About</a>
      <a href={`${process.env.PUBLIC_URL || ""}/#method`} onClick={closeMenu}>The science</a>
      <a href={`${process.env.PUBLIC_URL || ""}/#catalogue`} onClick={closeMenu}>Catalogue</a>
      <a href={`${process.env.PUBLIC_URL || ""}/#pricing`} onClick={closeMenu}>Pricing</a>
    </>
  );
  const accountLinks = (
    <>
      <Link to="/app" data-testid={NAV.dashboardLink} aria-current={pathname === "/app" ? "page" : undefined}>Dashboard</Link>
      <Link to="/app/scan/new" data-testid={NAV.newScanLink} aria-current={pathname === "/app/scan/new" ? "page" : undefined}>New screen</Link>
      <Link to="/app/library" aria-current={pathname === "/app/library" ? "page" : undefined}>Library</Link>
      <Link to="/app/billing" data-testid={NAV.pricingLink} aria-current={pathname === "/app/billing" ? "page" : undefined}>Plan &amp; billing</Link>
    </>
  );

  return (
    <header className="sc-site-header">
      <a className="sc-skip-link" href="#main-content">Skip to content</a>
      <div className="sc-site-nav">
        <Link to="/" data-testid={NAV.logo} className="sc-site-brand" aria-label="SONIC CHECK home">
          <img src={asset("/brand/logo-icon.png")} alt="" width="159" height="159" className="sc-site-icon" />
          <img src={asset("/brand/logo-wordmark.png")} alt="SONIC CHECK" width="1102" height="222" className="sc-site-wordmark" />
        </Link>
        <nav className="sc-site-desktop-links" aria-label="Primary navigation">{isSignedIn ? accountLinks : publicLinks}</nav>
        <div className="sc-site-account">
          {isSignedIn ? (
            <>
              <span className="sc-site-user" title={user?.email || clerkUser?.primaryEmailAddress?.emailAddress || "Signed in"}>{user?.email || clerkUser?.primaryEmailAddress?.emailAddress || "Signed in"}</span>
              <button onClick={handleLogout} data-testid={NAV.logoutBtn}>Log out</button>
            </>
          ) : <>
            <Link to="/login" data-testid={NAV.loginLink}>Log in</Link>
            <Link to="/join" className="sc-site-join" data-testid={NAV.signupLink}>Join</Link>
          </>}
        </div>
        <details className="sc-site-mobile-menu" ref={menuRef} onKeyDown={event => {
          if (event.key === "Escape") { closeMenu(); event.currentTarget.querySelector("summary").focus(); }
        }}>
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">{isSignedIn ? accountLinks : publicLinks}</nav>
        </details>
      </div>
    </header>
  );
}
