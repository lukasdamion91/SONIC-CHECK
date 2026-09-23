import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

async function text(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

test("living founder operating standard is present and linked", async () => {
  const [guide, workflow, agents, readme] = await Promise.all([
    text("OPERATING_GUIDE.md"),
    text("docs/WORKFLOW.md"),
    text("AGENTS.md"),
    text("README.md"),
  ]);

  for (const document of [guide, workflow]) {
    assert.match(document, /SC-FOUNDER-OPS\/2026-09-05\.1/u);
    assert.match(document, /RUNTIME_INTEGRATED/u);
    assert.match(document, /PRODUCTION_VERIFIED/u);
    assert.match(document, /RESEARCH_CLOSED_NOT_RUNTIME_INTEGRATED/u);
  }
  assert.match(guide, /Luke Damion, Architect, Founder and Global Director/u);
  assert.match(guide, /AUTHORIZED.*CONFIGURED.*EXERCISED.*PRODUCTION_INTEGRATED/us);
  assert.match(guide, /payment authorization are independent gates/iu);
  assert.match(guide, /deployment images/iu);
  assert.match(guide, /pasted into conversational/iu);
  assert.match(guide, /rotated before production\s+use/iu);
  assert.match(agents, /OPERATING_GUIDE\.md/u);
  assert.match(agents, /docs\/WORKFLOW\.md/u);
  assert.match(readme, /OPERATING_GUIDE\.md/u);
  assert.match(readme, /docs\/WORKFLOW\.md/u);
});

test("pull requests require delivery, provider, gate and privacy evidence", async () => {
  const template = await text(".github/pull_request_template.md");
  for (const required of [
    "Canonical entry point and call path",
    "Terms or permission evidence reviewed",
    "Provider gate before/after",
    "Payment gate before/after",
    "Private evidence excluded",
    "Exact head SHA",
    "Live probes",
    "Remaining limitations",
  ]) {
    assert.ok(template.includes(required), `missing PR evidence field: ${required}`);
  }
});

test("current delegation reaches frontend and retains evidence gates", async () => {
  const routes = [
    "GOVERNANCE.md",
    "AGENTS.md",
    "OPERATING_GUIDE.md",
    "docs/WORKFLOW.md",
    "docs/GOVERNANCE_ROUTING.md",
    "docs/ACCEPTANCE_STANDARD.md",
    "docs/GOVERNANCE_AUTONOMY_2026-09-23.md",
    "frontend/AGENTS.md",
    ".github/AGENTS.md",
    ".github/copilot-instructions.md",
    ".github/pull_request_template.md",
  ];
  for (const route of routes) {
    const document = await text(route);
    assert.match(document, /SC-FOUNDER-GOV\/2026-09-23\.1|SC-ACCEPTANCE-2026-09-22\.1/u, route);
  }
  const governance = await text("GOVERNANCE.md");
  const scope = await text("docs/GOVERNANCE_AUTONOMY_2026-09-23.md");
  const frontend = await text("frontend/AGENTS.md");
  assert.match(governance, /DELEGATED LAUNCH-DEVELOPMENT AUTHORITY/u);
  assert.match(governance, /The following decisions remain reserved/u);
  assert.match(scope, /does not\nchange rights, privacy or scientific thresholds/u);
  assert.match(frontend, /API release binding, CI, privacy/u);
  assert.doesNotMatch(frontend, /no old autonomous permission/u);
});

test("raw audio and private research paths are ignored", async () => {
  const ignore = await text(".gitignore");
  for (const pattern of [
    "project_sources/",
    "*.wav",
    "*.flac",
    "private-corpus/",
    "private-custody/",
  ]) {
    assert.ok(ignore.split(/\r?\n/u).includes(pattern), `missing ignore rule: ${pattern}`);
  }
});
