/**
 * Copying is a convenience after publication, never part of the publication
 * transaction. Browser clipboard policy can reject even after the API action
 * has succeeded, so this helper deliberately resolves to false instead of
 * turning a live public link into an apparent publication failure.
 */
export async function copyTextBestEffort(text, clipboard = globalThis.navigator?.clipboard) {
  if (typeof clipboard?.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A credit-consuming response can be lost after the server has committed its
 * debit. Refresh after every attempted consuming request, including transport
 * failures, so the next UI decision is based on server-owned state.
 */
export async function refreshAfterCreditAttempt(willConsume, refresh) {
  if (!willConsume || typeof refresh !== "function") return false;
  try {
    await refresh();
  } catch {
    // Artifact delivery/error reporting must not be replaced by refresh noise.
  }
  return true;
}
