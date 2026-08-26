import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = join(frontendRoot, "build", "index.html");
const fallbackPath = join(frontendRoot, "build", "404.html");

if (!existsSync(indexPath)) {
  throw new Error("Cannot prepare the Pages fallback before build/index.html exists.");
}

copyFileSync(indexPath, fallbackPath);
console.log("Prepared byte-identical GitHub Pages SPA fallback.");
