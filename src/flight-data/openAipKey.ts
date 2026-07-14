export const OPENAIP_API_KEY_STORAGE = "openaip.apiKey";

export function getOpenAipApiKey(): string | null {
  try {
    const value = localStorage.getItem(OPENAIP_API_KEY_STORAGE);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function setOpenAipApiKey(key: string | null): void {
  try {
    if (key && key.trim()) localStorage.setItem(OPENAIP_API_KEY_STORAGE, key.trim());
    else localStorage.removeItem(OPENAIP_API_KEY_STORAGE);
  } catch {
    /* storage unavailable — nothing to do */
  }
}
