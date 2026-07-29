/** US phone helpers — input masking and display formatting as (xxx) xxx-xxxx. */

/** Progressive mask for typing: 1234567890 -> (123) 456-7890 */
export function formatPhoneInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Display formatting; leaves non-10-digit values (e.g. international) as-is. */
export function formatPhoneDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return formatPhoneInput(digits);
  if (digits.length === 11 && digits.startsWith("1")) return formatPhoneInput(digits.slice(1));
  return raw;
}
