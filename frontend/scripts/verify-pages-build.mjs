import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const scriptRoot = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptRoot, "..");
const PRODUCT_CONTRACT = "SC-PRODUCT/2026.08.20.1";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function meta(html, name) {
  const pattern = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']\\s*/?>`, "i");
  return html.match(pattern)?.[1] || "";
}

export function verifyPagesBuild({ root = frontendRoot, expectedCommit = "", requireAuth = false } = {}) {
  const build = join(root, "build");
  const indexPath = join(build, "index.html");
  const fallbackPath = join(build, "404.html");
  const cnamePath = join(build, "CNAME");
  const assetManifestPath = join(build, "asset-manifest.json");
  const javascriptPath = join(build, "static", "js");
  const appPath = join(root, "src", "App.js");
  const failures = [];
  for (const path of [indexPath, fallbackPath, cnamePath, assetManifestPath, javascriptPath, appPath]) {
    if (!existsSync(path)) failures.push(`MISSING:${path.slice(root.length + 1)}`);
  }
  if (failures.length) {
    return { ok: false, failures, readiness: { auth_configured: false } };
  }
  const index = readFileSync(indexPath);
  const fallback = readFileSync(fallbackPath);
  const html = index.toString("utf8");
  const cname = readFileSync(cnamePath, "utf8").trim();
  const app = readFileSync(appPath, "utf8");
  const deploymentCommit = meta(html, "soniccheck-deployment-commit");
  const productContract = meta(html, "soniccheck-product-contract");
  const authMarker = meta(html, "soniccheck-auth-configured");
  const requiredRoutes = [
    "/", "/login", "/join", "/privacy", "/terms", "/app",
    "/app/billing", "/app/scan/new", "/app/library",
  ];
  const missingRoutes = requiredRoutes.filter((route) => !app.includes(`path="${route}"`));
  if (!index.equals(fallback)) failures.push("SPA_FALLBACK_NOT_BYTE_IDENTICAL");
  if (cname !== "soniccheck.io") failures.push("CANONICAL_CNAME_MISMATCH");
  if (!deploymentCommit || deploymentCommit.includes("%REACT_APP_")) failures.push("DEPLOYMENT_COMMIT_NOT_STAMPED");
  if (expectedCommit && deploymentCommit !== expectedCommit) failures.push("DEPLOYMENT_COMMIT_MISMATCH");
  if (productContract !== PRODUCT_CONTRACT) failures.push("PRODUCT_CONTRACT_MISMATCH");
  if (!["true", "false"].includes(authMarker)) failures.push("AUTH_CONFIGURATION_MARKER_INVALID");
  if (requireAuth && authMarker !== "true") failures.push("AUTH_NOT_CONFIGURED");
  if (missingRoutes.length) failures.push(`ROUTES_MISSING:${missingRoutes.join(",")}`);
  const assetManifest = readFileSync(assetManifestPath, "utf8");
  return {
    schema_version: "soniccheck-pages-build-verification/1.0.0",
    ok: failures.length === 0,
    failures,
    artifact: {
      index_sha256: sha256(index),
      fallback_sha256: sha256(fallback),
      fallback_byte_identical: index.equals(fallback),
      cname,
      deployment_commit: deploymentCommit,
      product_contract: productContract,
      asset_manifest_sha256: sha256(assetManifest),
    },
    routing: {
      strategy: "github-pages-404-spa-fallback",
      required_routes: requiredRoutes,
      missing_routes: missingRoutes,
    },
    readiness: {
      auth_configured: authMarker === "true",
      auth_marker: authMarker || "missing",
    },
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyPagesBuild({
    expectedCommit: argument("--expected-commit"),
    requireAuth: argument("--require-auth") === "true",
  });
  const output = argument("--output");
  if (output) writeFileSync(resolve(output), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}
