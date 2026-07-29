/**
 * Title-Case button labels: capitalize the first letter of each word.
 * Keeps separators like & and - in place.
 */
export function toTitleCaseLabel(value) {
  if (value == null) return value;
  const str = String(value).trim();
  if (!str) return str;
  return str
    .split(/\s+/)
    .map((word) =>
      word
        .split(/([-&/→])/u)
        .map((part) => {
          if (!part || /^[-&/→]$/u.test(part)) return part;
          return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
        })
        .join("")
    )
    .join(" ");
}
