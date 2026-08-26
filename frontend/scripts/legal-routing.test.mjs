import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { matchPath } from "react-router-dom";
import test from "node:test";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("privacy and terms remain public canonical routes", async () => {
  const [app, landing, register, legalPage] = await Promise.all([
    source("../src/App.js"),
    source("../src/pages/Landing.jsx"),
    source("../src/pages/Register.jsx"),
    source("../src/components/LegalPage.jsx"),
  ]);

  assert.match(app, /path="\/privacy" element=\{<Privacy \/>\}/);
  assert.match(app, /path="\/terms" element=\{<Terms \/>\}/);
  assert.match(landing, /to="\/privacy\/"/);
  assert.match(landing, /to="\/terms\/"/);
  assert.match(register, /By continuing to create an account/);
  assert.match(register, /to="\/privacy\/"/);
  assert.match(register, /to="\/terms\/"/);
  assert.match(legalPage, /to="\/privacy\/"/);
  assert.match(legalPage, /to="\/terms\/"/);
});

test("React Router accepts the canonical trailing-slash policy URLs", () => {
  assert.ok(matchPath({ path: "/privacy", end: true }, "/privacy/"));
  assert.ok(matchPath({ path: "/terms", end: true }, "/terms/"));
});

test("privacy copy describes Google basic identity without broader Google access", async () => {
  const privacy = await source("../src/pages/Privacy.jsx");

  assert.match(privacy, /<code>openid<\/code>, <code>email<\/code> and <code>profile<\/code>/);
  assert.match(privacy, /stable Google account identifier/);
  assert.match(privacy, /not proof of a person's real-world identity/);
  assert.match(privacy, /does not request access to your Gmail, Google Drive, contacts or calendar/);
  assert.match(privacy, /not an input to audio matching, similarity scoring or evidence conclusions/);
});

test("policies disclose public badge fields and current deletion limits", async () => {
  const [privacy, terms, scanResult] = await Promise.all([
    source("../src/pages/Privacy.jsx"),
    source("../src/pages/Terms.jsx"),
    source("../src/pages/ScanResult.jsx"),
  ]);

  assert.match(privacy, /anyone with the link can view/);
  assert.match(privacy, /does not expose the raw audio, full lyric text or your account email/);
  assert.match(privacy, /physical-deletion evidence are not yet certified end to end/);
  assert.match(terms, /Share record/);
  assert.match(terms, /anyone with the link/);
  assert.match(scanResult, /Publish a public record showing/);
  assert.match(scanResult, /if \(!confirmed\) return/);
});

test("terms preserve the evidence and Australian consumer boundaries", async () => {
  const terms = await source("../src/pages/Terms.jsx");

  assert.match(terms, /not automatic determinations of authorship, originality, ownership/);
  assert.match(terms, /Australian Consumer Law/);
  assert.match(terms, /laws of Victoria, Australia/);
});
