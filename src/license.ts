const SLUG = 'raw-sidecar-sanity';
const TOKEN_KEY = `sb_license:${SLUG}`;
const CACHE_KEY = `${TOKEN_KEY}:verdict`;
const VERIFY_AFTER = 24 * 60 * 60 * 1000;
export const checkoutUrl = `https://api.sociobot.in/api/v1/products/${SLUG}/checkout`;

export interface LicenseState { unlocked: boolean; message?: string; checking?: boolean }

export function captureLicense(): string | null {
  const url = new URL(location.href);
  const returned = url.searchParams.get('license');
  if (returned) {
    localStorage.setItem(TOKEN_KEY, returned.trim());
    localStorage.removeItem(CACHE_KEY);
    url.searchParams.delete('license');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
  return returned ?? localStorage.getItem(TOKEN_KEY);
}

export function storeLicense(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
  localStorage.removeItem(CACHE_KEY);
}

export function removeLicense(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CACHE_KEY);
}

export function optimisticLicense(): LicenseState {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { unlocked: false };
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as { valid?: boolean };
    return cache.valid ? { unlocked: true, checking: true } : { unlocked: false, checking: true };
  } catch { return { unlocked: false, checking: true }; }
}

export async function verifyLicense(force = false): Promise<LicenseState> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { unlocked: false };
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as { valid?: boolean; checkedAt?: number };
    if (!force && cached.checkedAt && Date.now() - cached.checkedAt < VERIFY_AFTER) return { unlocked: Boolean(cached.valid) };
  } catch { /* verify malformed cache */ }
  try {
    const response = await fetch(`https://api.sociobot.in/api/v1/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('Verification service unavailable');
    const verdict = await response.json() as { valid: boolean; reason?: string };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ valid: verdict.valid, checkedAt: Date.now() }));
    return verdict.valid ? { unlocked: true } : { unlocked: false, message: 'License no longer active. You can restore a different license or buy a new one.' };
  } catch {
    const optimistic = optimisticLicense();
    return { ...optimistic, checking: false, message: optimistic.unlocked ? 'Offline: using the last valid license check.' : 'Could not verify this license. Your free checker still works.' };
  }
}
