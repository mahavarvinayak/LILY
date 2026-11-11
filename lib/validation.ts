export const MAX_AGENCY_NAME_LENGTH = 80;

/**
 * Normalise a client-supplied agency name: drop angle brackets and control
 * characters, collapse whitespace, trim, and cap the length. The value is
 * displayed in the UI and interpolated into email headers and bodies, so it is
 * stored clean and escaped again at render time.
 */
export function normalizeAgencyName(raw: string) {
  return raw
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_AGENCY_NAME_LENGTH);
}
