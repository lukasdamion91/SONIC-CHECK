import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Clerk publishes canonical routes for OAuth transfer flows", async () => {
  const authContext = await source("../src/context/AuthContext.jsx");

  assert.match(authContext, /<ClerkProvider[\s\S]*signInUrl="\/login"/);
  assert.match(authContext, /<ClerkProvider[\s\S]*signUpUrl="\/join"/);
});

test("sign-in preserves the protected destination when OAuth transfers to sign-up", async () => {
  const login = await source("../src/pages/Login.jsx");

  assert.match(login, /<SignIn[\s\S]*signUpUrl="\/join"/);
  assert.match(login, /signUpFallbackRedirectUrl=\{redirect\}/);
  assert.match(login, /signUpForceRedirectUrl=\{redirect\}/);
});

test("sign-up preserves the protected destination when OAuth transfers to sign-in", async () => {
  const register = await source("../src/pages/Register.jsx");

  assert.match(register, /<SignUp[\s\S]*signInUrl="\/login"/);
  assert.match(register, /signInFallbackRedirectUrl=\{redirect\}/);
  assert.match(register, /signInForceRedirectUrl=\{redirect\}/);
});
