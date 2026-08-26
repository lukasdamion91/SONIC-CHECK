import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPattern = /<link\s+rel=["']canonical["']\s+href=["']https:\/\/soniccheck\.io\/["']\s*\/?>/i;
const descriptionPattern = /<meta name="description" content="[^"]*"\s*\/>/;
const titlePattern = /<title>[^<]*<\/title>/;
const policyRoutes = {
  privacy: {
    canonical: "https://soniccheck.io/privacy/",
    description: "How SONIC CHECK handles account, Google sign-in and customer-submission data.",
    title: "Privacy Policy — SONIC CHECK",
  },
  terms: {
    canonical: "https://soniccheck.io/terms/",
    description: "Terms governing customer access to the SONIC CHECK controlled-beta service.",
    title: "Terms of Use — SONIC CHECK",
  },
};

export function preparePagesBuild({ root = frontendRoot } = {}) {
  const build = join(root, "build");
  const indexPath = join(build, "index.html");
  const fallbackPath = join(build, "404.html");
  if (!existsSync(indexPath)) {
    throw new Error("Cannot prepare the Pages fallback before build/index.html exists.");
  }

  const index = readFileSync(indexPath, "utf8");
  const occurrenceCount = (pattern) => (
    index.match(new RegExp(pattern.source, `${pattern.flags}g`)) || []
  ).length;
  if (occurrenceCount(canonicalPattern) !== 1) {
    throw new Error("The canonical homepage marker must occur exactly once in build/index.html.");
  }
  if (occurrenceCount(descriptionPattern) !== 1 || occurrenceCount(titlePattern) !== 1) {
    throw new Error("The build entry point must contain one description and title marker.");
  }

  copyFileSync(indexPath, fallbackPath);
  for (const [route, metadata] of Object.entries(policyRoutes)) {
    const directory = join(build, route);
    mkdirSync(directory, { recursive: true });
    const policyEntry = index
      .replace(canonicalPattern, `<link rel="canonical" href="${metadata.canonical}" />`)
      .replace(descriptionPattern, `<meta name="description" content="${metadata.description}" />`)
      .replace(titlePattern, `<title>${metadata.title}</title>`);
    writeFileSync(join(directory, "index.html"), policyEntry);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preparePagesBuild();
  console.log("Prepared GitHub Pages SPA fallback and canonical public-policy entry points.");
}
