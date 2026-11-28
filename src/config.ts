// Angaben für die Datenschutzseite. Werden über GitHub Actions Variables gesetzt
// (VITE_VERANTWORTLICH_NAME, VITE_VERANTWORTLICH_KONTAKT), damit sie nicht im Code stehen müssen.
// Solange sie fehlen, zeigt die Datenschutzseite einen deutlichen Hinweis.
export const VERANTWORTLICH_NAME = (import.meta.env.VITE_VERANTWORTLICH_NAME as string | undefined)?.trim() || "";
export const VERANTWORTLICH_KONTAKT = (import.meta.env.VITE_VERANTWORTLICH_KONTAKT as string | undefined)?.trim() || "";
export const STAND_DATENSCHUTZ = "28.11.2026";
