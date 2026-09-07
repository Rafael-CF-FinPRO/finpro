export type Theme = "light" | "dark";

// Absence of the cookie means "system" — resolved entirely by the
// prefers-color-scheme media query in globals.css, no stored value
// needed for that state.
export const THEME_COOKIE_NAME = "finpro_theme";

export function isValidTheme(value: string | undefined): value is Theme {
  return value === "light" || value === "dark";
}
