// ──────────────────────────────────────────────────────────────
// shop-891 — Shared form-validation helpers
//
// Empty/invalid fields must never fail silently or only via the
// browser's native "please fill this in" tooltip. Every form in
// the app uses these helpers so a failed submit always:
//   1. shows an inline message next to the field,
//   2. highlights the field (red border + shake),
//   3. scrolls the first invalid field into view and focuses it —
//      the user is taken straight to WHERE the problem is.
// ──────────────────────────────────────────────────────────────

export type FieldErrors = Record<string, string>;

/** A form field: its key inside `errors` + the DOM id of the input. */
export interface ErrorField {
  key: string;
  id: string;
}

/**
 * Scroll to and focus the first field that has an error.
 * Returns true when an error field was found and targeted.
 */
export function focusFirstError(
  errors: FieldErrors,
  fields: ErrorField[]
): boolean {
  if (typeof document === "undefined") return false;
  for (const f of fields) {
    if (!errors[f.key]) continue;
    const el = document.getElementById(f.id);
    if (!el) continue;
    // Scroll first (smooth), then focus once the scroll has settled
    // so the browser doesn't cancel the scroll to jump at the field.
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      el.scrollIntoView();
    }
    window.setTimeout(() => {
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* non-focusable elements are fine */
      }
    }, 320);
    return true;
  }
  return false;
}

/**
 * Conditional class for an input with an error: red border, soft
 * red focus ring and a subtle shake so the eye lands on it.
 * Combine with `aria-invalid` for screen readers (the shadcn Input
 * already styles aria-invalid with destructive colors).
 */
export function errorFieldClass(hasError: boolean | undefined): string {
  return hasError ? "border-destructive/70 field-error-shake" : "";
}

/** Standard inline error paragraph for below a field. */
export function fieldErrorMessage(
  message: string | undefined,
  id?: string
): { message: string; id: string } | null {
  if (!message) return null;
  return { message, id: id ?? "" };
}
