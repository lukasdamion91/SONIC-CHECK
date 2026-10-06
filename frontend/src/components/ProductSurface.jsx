import { useLocation } from "react-router-dom";
import "@/Product.css";

/** Scope the studio identity to the product; the approved landing stays intact. */
export default function ProductSurface({ children }) {
  const { pathname } = useLocation();
  // React Router accepts case variants and trailing slashes for these routes.
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const product = path === "/app" || path.startsWith("/app/") || ["/login", "/join"].includes(path);
  return <div className={product ? "sc-product" : undefined}>{children}</div>;
}
