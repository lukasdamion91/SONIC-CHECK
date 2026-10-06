import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AUDIO_UPLOAD_LIMIT_LABEL, MAX_AUDIO_UPLOAD_BYTES, audioUploadValidationError } from "../src/lib/audioUpload.mjs";

test("audio upload limit is inclusive decimal 100 MB", () => {
  assert.equal(MAX_AUDIO_UPLOAD_BYTES, 100_000_000);
  assert.equal(AUDIO_UPLOAD_LIMIT_LABEL, "100 MB");
  for (const size of [1, 25_000_000, 40_320_172, 99_999_999, 100_000_000]) {
    assert.equal(audioUploadValidationError({ size }), "", `accept ${size} bytes`);
  }
  for (const size of [100_000_001, 100 * 1024 * 1024]) {
    assert.match(audioUploadValidationError({ size }), /exceeds the 100 MB limit/u, `reject ${size} bytes`);
  }
});

test("lyrics-only remains eligible and empty or invalid audio is rejected", () => {
  assert.equal(audioUploadValidationError(null), "");
  assert.match(audioUploadValidationError({ size: 0 }), /empty/u);
  for (const size of [-1, NaN, Infinity, "100", 1.5]) {
    assert.match(audioUploadValidationError({ size }), /could not be read/u);
  }
});

test("selection and submission enforce the shared limit before FormData or network calls", async () => {
  const source = await readFile(new URL("../src/pages/NewScan.jsx", import.meta.url), "utf8");
  const submit = source.indexOf("const submit = async");
  const validation = source.indexOf("audioUploadValidationError(audioFile)", submit);
  assert.ok(validation > submit);
  assert.ok(validation < source.indexOf("new FormData()", submit));
  assert.ok(validation < source.indexOf('api.post("/scans/upload"', submit));
  assert.match(source, /audioUploadValidationError\(nextAudioFile\)/u);
  assert.match(source, /Up to \{AUDIO_UPLOAD_LIMIT_LABEL\}/u);
});
