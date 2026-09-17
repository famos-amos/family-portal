import * as Crypto from 'expo-crypto';

/** SHA-256 hex digest of a PIN. The raw PIN is never stored or sent anywhere
 * — only this hash goes to Supabase, and only this hash is compared against
 * on unlock. Not meant to withstand a serious offline attack (a 4-digit PIN
 * is only 10,000 combinations either way) — this is a soft gate against
 * casual access, matching the rest of the app's security posture. */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}
