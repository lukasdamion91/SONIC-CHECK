import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployedFiles = [
  "public/index.html",
  "src/App.js",
  "src/components/Navbar.jsx",
  "src/components/ProtectedRoute.jsx",
  "src/pages/Landing.jsx",
  "src/pages/Login.jsx",
  "src/pages/Register.jsx",
  "src/pages/Pricing.jsx",
  "src/pages/Dashboard.jsx",
  "src/pages/NewScan.jsx",
  "src/pages/ScanResult.jsx",
  "src/pages/Library.jsx",
  "src/pages/PaymentSuccess.jsx",
  "src/pages/VerifyBadge.jsx",
];

const prohibited = [
  "turnitin for music",
  "plagiarism intelligence",
  "settle it before the lawsuit",
  "millions of copyrighted works",
  "global reference catalog",
  "forensic-grade",
  "defensible in court",
  "admissible in dispute",
  "automatic infringement claim",
  "regional verdict",
  "run unlimited scans",
];

const contents = await Promise.all(
  deployedFiles.map(async (relativePath) => ({
    relativePath,
    text: (await readFile(path.join(root, relativePath), "utf8")).toLowerCase(),
  })),
);

const violations = [];
for (const { relativePath, text } of contents) {
  for (const phrase of prohibited) {
    if (text.includes(phrase)) violations.push(`${relativePath}: ${phrase}`);
  }
}

const landing = contents.find(({ relativePath }) => relativePath === "src/pages/Landing.jsx")?.text || "";
for (const required of ["candidate evidence", "human review required", "aud pricing"]) {
  if (!landing.includes(required)) violations.push(`src/pages/Landing.jsx: missing required boundary phrase '${required}'`);
}

if (violations.length) {
  console.error("Public claims validation failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Public claims validation passed for ${deployedFiles.length} deployed source files.`);
