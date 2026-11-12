/**
 * Server-only secrets shared by the passwordless auth routes.
 *
 * The OTP hash is an HMAC over `email:code`. Its key must be stable and private:
 * the Supabase anon key is shipped to every browser, and the old committed
 * fallback string is public, so neither may ever be used here.
 */
export function getAuthSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Authentication signing key is not configured. Set ENCRYPTION_SECRET (or SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return secret;
}
