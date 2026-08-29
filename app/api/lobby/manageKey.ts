import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generateManageKey() {
  return randomBytes(18).toString("base64url");
}

export function hashManageKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function verifyManageKey(key: string, expectedHash: string | null | undefined) {
  if (!expectedHash || !key) return false;
  const providedHash = hashManageKey(key);
  const a = Buffer.from(providedHash, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function secureTextEqual(value: string, expected: string) {
  if (!value || !expected) return false;
  const provided = Buffer.from(value, "utf8");
  const configured = Buffer.from(expected, "utf8");
  if (provided.length !== configured.length) return false;
  return timingSafeEqual(provided, configured);
}

export function verifyLobbyDeleteCredential(
  credential: string,
  expectedManageKeyHash: string | null | undefined,
  deletionPassword: string
) {
  return (
    verifyManageKey(credential, expectedManageKeyHash) ||
    secureTextEqual(credential, deletionPassword)
  );
}
