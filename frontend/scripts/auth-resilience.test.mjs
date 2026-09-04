import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { safeAppRedirect } from "../src/lib/safeAppRedirect.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = (relative) => fs.readFileSync(path.join(here, relative), "utf8");

test("post-auth redirects stay on the protected app route boundary", () => {
  assert.equal(safeAppRedirect("/app"), "/app");
  assert.equal(safeAppRedirect("/app/scans/controlled"), "/app/scans/controlled");
  assert.equal(safeAppRedirect("/app?tab=history"), "/app?tab=history");
  assert.equal(safeAppRedirect("/application"), "/app");
  assert.equal(safeAppRedirect("//example.invalid/app"), "/app");
  assert.equal(safeAppRedirect("https://example.invalid/app"), "/app");
});

test("signed-in logout remains visible when API profile loading fails", () => {
  const navbar = source("../src/components/Navbar.jsx");
  assert.match(navbar, /isSignedIn \? \(/);
  assert.match(navbar, /user\?\.email \|\| clerkUser\?\.primaryEmailAddress/);
  assert.match(navbar, /data-testid=\{NAV\.logoutBtn\}/);
});

test("API requests have a bounded outage timeout", () => {
  const api = source("../src/lib/api.js");
  assert.match(api, /timeout:\s*30000/);
});
