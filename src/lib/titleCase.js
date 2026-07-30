/**
 * Strict Title Case: capitalize the first letter of each word; force the rest lowercase.
 * Used for button labels and one-shot formatting (trims).
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

/**
 * Strict Title Case for live inputs — same rules as toTitleCaseLabel, but preserves
 * spaces while the user is typing (does not trim).
 */
export function toStrictTitleCase(value) {
  const str = String(value ?? "");
  if (!str) return str;
  return str.replace(/\S+/g, (word) =>
    word
      .split(/([-&/→])/u)
      .map((part) => {
        if (!part || /^[-&/→]$/u.test(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join("")
  );
}

/**
 * Soft Title Case (activity titles, organizer names):
 * - Capitalize the start of each word
 * - Leave the rest of each word as typed (so STEM, YMCA, etc. stay uppercase)
 * - If the whole title is shouted in ALL CAPS, convert to Strict Title Case
 */
export function formatActivityTitle(value) {
  const str = String(value ?? "");
  if (!str) return str;

  const lettersOnly = str.replace(/[^A-Za-z]/g, "");
  const words = str.trim().split(/\s+/).filter(Boolean);
  const isShouting =
    lettersOnly.length >= 6
    && lettersOnly === lettersOnly.toUpperCase()
    && (words.length >= 2 || lettersOnly.length >= 12);

  if (isShouting) {
    return str.replace(/\w\S*/g, (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  }

  // Soft: uppercase a lowercase letter that starts a word; do not force the rest lowercase
  return str.replace(/(^|[\s/\\(\[{"'])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}
