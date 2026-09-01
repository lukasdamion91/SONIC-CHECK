/** Keep post-auth navigation inside the protected `/app` route boundary. */
export function safeAppRedirect(value) {
  if (typeof value !== "string") return "/app";
  if (value === "/app" || value.startsWith("/app/") || value.startsWith("/app?")) {
    return value;
  }
  return "/app";
}
