import assert from "node:assert/strict";
import { readFile, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
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
    assert.match(document, /LDJ-GOV\/2026-10-11\.1/u);
    assert.match(document, /RUNTIME_INTEGRATED/u);
    assert.match(document, /PRODUCTION_VERIFIED/u);
    assert.match(document, /RESEARCH_CLOSED_NOT_RUNTIME_INTEGRATED/u);
  }
  assert.match(guide, /Damion Lukas, Architect, Founder and Global Director/u);
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

const ROUTES = [
  "GOVERNANCE.md", "AGENTS.md", "OPERATING_GUIDE.md", "docs/WORKFLOW.md",
  "docs/GOVERNANCE_ROUTING.md", "docs/FOUNDER_AUTHORITY_CURRENT.md",
  "docs/ACCEPTANCE_STANDARD.md", "docs/BETA_ACCEPTANCE_CURRENT.md", "docs/AGENTS.md", "docs/scanner/AGENTS.md",
  "operations/AGENTS.md", "validation/AGENTS.md", "frontend/AGENTS.md",
  ".github/AGENTS.md", ".github/copilot-instructions.md", ".github/pull_request_template.md",
];
const HISTORICAL = {"operations/governance/ADOPTION.json": "ccef03fc1cc64fc25d87a08821d03624150d77429bb014cffd07cf837b68dc8a", "docs/GOVERNANCE_AUTONOMY_2026-09-23.md": "4aa34970360d4361f34cde35af9aa98565c5b6b1c78660639fe93c136c647ca2"};

async function verifyRouting(root) {
  const read = (name) => readFile(path.join(root, name), "utf8");
  for (const route of ROUTES) {
    const document = (await read(route)).replace(/\s+/gu, " ");
    assert.ok(document.includes("LDJ-GOV/2026-10-11.1"), `stale route: ${route}`);
    assert.doesNotMatch(document, /The current delegation permits|Luke's current delegation permits|without exact-revision manual approval|in-scope development is delegated/u, route);
  }
  const governance = (await read("GOVERNANCE.md")).replace(/\s+/gu, " ");
  for (const boundary of ["specific Founder approval after personal review", "externally triggered CI",
    "Approval persists across conversations, agents and sessions", "Material changes require renewed review",
    "Numerical targets, known failures and missing evidence are unchanged"])
    assert.ok(governance.includes(boundary), `missing Founder boundary: ${boundary}`);
  const record = JSON.parse(await read("operations/governance/CURRENT.json"));
  assert.equal(record.governance_id, "LDJ-GOV/2026-10-11.1");
  assert.equal(record.source_sha256, "c5eef7db214cd8756f19b68ed42974a324702288bb00d12a8daac03185cad6e0");
  assert.equal(record.source_bytes, 36750);
  assert.equal(record.release_approval_granted_by_record, false);
  assert.deepEqual(record.historical_evidence_sha256, HISTORICAL);
  for (const [name, digest] of Object.entries(HISTORICAL))
    assert.equal(createHash("sha256").update(await readFile(path.join(root, name))).digest("hex"), digest, name);
  assert.match(await read("frontend/AGENTS.md"), /API release binding, CI, privacy/u);
}

test("current specific approval routes preserve historical evidence", async () => {
  await verifyRouting(ROOT);
});

for (const [name, file, mutate] of [
  ["stale route", "frontend/AGENTS.md", s => s.replaceAll("LDJ-GOV/2026-10-11.1", "OLD")],
  ["blanket release permission", ".github/AGENTS.md", s => s + "\nThe current delegation permits automatic merge.\n"],
  ["removed continuity", "GOVERNANCE.md", s => s.replace("Approval\npersists across conversations, agents and sessions", "Approval expires on handoff")],
  ["historical rewrite", "operations/governance/ADOPTION.json", s => s + "\n"],
  ["record grants approval", "operations/governance/CURRENT.json", s => JSON.stringify({...JSON.parse(s), release_approval_granted_by_record:true})],
]) {
  test(`routing rejects ${name}`, async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "sc-governance-"));
    try {
      for (const route of [...ROUTES, ...Object.keys(HISTORICAL), "operations/governance/CURRENT.json"])
        await cp(path.join(ROOT, route), path.join(temporary, route), {recursive:true});
      const target = path.join(temporary, file);
      await writeFile(target, mutate(await readFile(target, "utf8")));
      await assert.rejects(verifyRouting(temporary));
    } finally {
      await rm(temporary, {recursive:true, force:true});
    }
  });
}

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
