import { useLocation } from "react-router-dom";
import "@/Product.css";

/** Scope the studio identity to the product; the approved landing stays intact. */
export default function ProductSurface({ children }) {
  const { pathname } = useLocation();
  const product = pathname === "/app" || pathname.startsWith("/app/") || ["/login", "/join"].includes(pathname);
  return <div className={product ? "sc-product" : undefined}>{children}</div>;
}
