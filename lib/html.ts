/**
 * Helpers for building transactional email safely.
 *
 * Anything that reaches an email header or an HTML body must go through one of
 * these: `agency_name` is client-registered text and a raw newline in a subject
 * is header injection, while raw `<a href=…>` in a body is a phishing relay
 * from our own verified sending domain.
 */

/** Escape a value for interpolation into an HTML email body. */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Collapse a value into a single-line, header-safe string: no CR/LF, no other
 * control characters, no runs of whitespace, hard-capped length.
 */
export function headerText(value: string, maxLength = 120) {
  return value
    .replace(/[\r\n\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
