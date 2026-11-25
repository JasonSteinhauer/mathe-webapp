// Anzeige-Styles: Vorlagen, eigene Styles, Farb-Mathe (Hex/RGB/HSL, Kontrast) und Anwenden per CSS-Variablen.
// Gespeichert wird nur im Browser (localStorage) – keine Daten in der Datenbank.

export const FARBEN = ["paper", "grid", "card", "ink", "muted", "line", "accent", "accentInk", "ok", "mid", "bad", "open"] as const;
export type FarbName = (typeof FARBEN)[number];
export type Farben = Record<FarbName, string>;

export const FARB_LABEL: Record<FarbName, string> = {
  paper: "Hintergrund", grid: "Karolinien", card: "Karten", ink: "Text", muted: "Text gedämpft", line: "Rahmen",
  accent: "Akzent", accentInk: "Text auf Akzent", ok: "Richtig", mid: "Teilweise", bad: "Fehler", open: "Offen",
};

export type Schrift = "system" | "serif" | "mono";
export interface Optionen { radius: number; raster: boolean; schrift: Schrift; groesse: number }
export interface Stil { id: string; name: string; farben: Farben; optionen: Optionen; eigen?: boolean }

export const STANDARD_OPTIONEN: Optionen = { radius: 10, raster: true, schrift: "system", groesse: 100 };

const f = (s: string): Farben => {
  const w = s.trim().split(/\s+/);
  return Object.fromEntries(FARBEN.map((k, i) => [k, w[i]])) as Farben;
};

// Reihenfolge: paper grid card ink muted line accent accentInk ok mid bad open
export const VORLAGEN: Stil[] = [
  { id: "hell", name: "Standard hell", farben: f("#f4f7fb #e3e9f2 #ffffff #172033 #596377 #d6dde8 #2b4fd8 #ffffff #1d7f47 #a8690f #be3129 #6b7280"), optionen: STANDARD_OPTIONEN },
  { id: "dunkel", name: "Standard dunkel", farben: f("#0f131a #1a2130 #161c27 #e7ebf3 #9ba5b7 #2a3345 #86a0ff #0f131a #56c98b #e6ad52 #f2786f #a3abb9"), optionen: STANDARD_OPTIONEN },
  { id: "sepia", name: "Sepia", farben: f("#f5efe3 #e8dfcc #fffaf0 #2b2118 #6b5a47 #dccfb8 #8a4b12 #ffffff #2f6b2f #8a5a00 #a3271f #6e6458"), optionen: { ...STANDARD_OPTIONEN, schrift: "serif" } },
  { id: "ozean", name: "Ozean", farben: f("#f0f7f8 #dcebee #ffffff #10272c #4c6a70 #cfe2e6 #0b7285 #ffffff #1d7f47 #9c6500 #c0352b #5f6f73"), optionen: STANDARD_OPTIONEN },
  { id: "rose", name: "Rosé", farben: f("#fbf3f5 #f1e1e6 #ffffff #2a1a20 #6f5560 #ead4dc #b0305e #ffffff #1f7a4a #9a640c #b3261e #6f6670"), optionen: { ...STANDARD_OPTIONEN, radius: 16 } },
  { id: "wald", name: "Wald", farben: f("#0e1512 #16211c #141d18 #e3ede7 #9bb0a4 #26362e #5fd39a #0e1512 #6fd98f #e2b552 #f07a6e #9aa9a0"), optionen: STANDARD_OPTIONEN },
  { id: "mitternacht", name: "Mitternacht", farben: f("#0d0b1a #171433 #15122b #ebe8ff #a7a1cc #2b2650 #b39bff #0d0b1a #5fd3a0 #f0b85a #ff7f8a #a7a1cc"), optionen: STANDARD_OPTIONEN },
  { id: "terminal", name: "Terminal", farben: f("#050805 #0c140c #0a0f0a #c8f7c8 #7fbf7f #1d3a1d #39ff6a #031003 #39ff6a #ffd75f #ff6b6b #7fbf7f"), optionen: { radius: 2, raster: true, schrift: "mono", groesse: 100 } },
  { id: "kontrast-hell", name: "Hoher Kontrast hell", farben: f("#ffffff #ffffff #ffffff #000000 #333333 #000000 #0000c8 #ffffff #006400 #7a4a00 #b00000 #444444"), optionen: { radius: 4, raster: false, schrift: "system", groesse: 110 } },
  { id: "kontrast-dunkel", name: "Hoher Kontrast dunkel", farben: f("#000000 #000000 #000000 #ffffff #d0d0d0 #ffffff #ffd400 #000000 #5dff8a #ffd400 #ff6b6b #d0d0d0"), optionen: { radius: 4, raster: false, schrift: "system", groesse: 110 } },
];

/* ---------------- Farb-Mathe ---------------- */
export type RGB = [number, number, number];
const klemm = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const istHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s.trim());

export function normHex(s: string): string | null {
  let t = s.trim().toLowerCase();
  if (!t.startsWith("#")) t = "#" + t;
  if (/^#[0-9a-f]{3}$/.test(t)) t = "#" + t.slice(1).split("").map((c) => c + c).join("");
  return istHex(t) ? t : null;
}
export function hexZuRgb(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbZuHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((x) => klemm(Math.round(x), 0, 255).toString(16).padStart(2, "0")).join("");
}
export function rgbZuHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
export function hslZuHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = klemm(s, 0, 100) / 100; l = klemm(l, 0, 100) / 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const fn = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbZuHex([fn(0) * 255, fn(8) * 255, fn(4) * 255]);
}
/** Mischt a mit b (t = Anteil von a) */
export function mische(a: string, b: string, t: number): string {
  const x = hexZuRgb(a), y = hexZuRgb(b);
  return rgbZuHex([0, 1, 2].map((i) => x[i] * t + y[i] * (1 - t)) as RGB);
}
function luminanz(h: string): number {
  return hexZuRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
/** WCAG-Kontrastverhältnis 1–21 */
export function kontrast(a: string, b: string): number {
  const x = luminanz(a), y = luminanz(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const istDunkel = (h: string) => luminanz(h) < 0.2;

/** Verschiebt die Helligkeit von c, bis der Kontrast zu hinter >= ziel ist */
function mitKontrast(c: string, hinter: string, ziel: number): string {
  const [h, s, l0] = rgbZuHsl(hexZuRgb(c));
  const richtung = istDunkel(hinter) ? 1 : -1;
  let l = l0, x = c;
  for (let i = 0; i < 100 && kontrast(x, hinter) < ziel; i++) { l += richtung; x = hslZuHex(h, s, l); }
  return x;
}

/* ---------------- Palette aus einer Farbe ---------------- */
export type Harmonie = "ton" | "komplementaer" | "analog" | "triade";
export const HARMONIE_LABEL: Record<Harmonie, string> = { ton: "Ton in Ton", komplementaer: "Komplementär", analog: "Analog", triade: "Triade" };

export function palette(basis: string, dunkel: boolean, harmonie: Harmonie): Farben {
  const [h, s] = rgbZuHsl(hexZuRgb(basis));
  // Neutrale Töne: leicht in Richtung des Farbtons (bzw. der Harmonie-Farbe) getönt
  const nh = harmonie === "komplementaer" ? h + 180 : harmonie === "analog" ? h + 30 : harmonie === "triade" ? h + 120 : h;
  const ns = Math.min(s, 30);
  const n = dunkel
    ? { paper: hslZuHex(nh, ns * 0.8, 7), grid: hslZuHex(nh, ns * 0.8, 12), card: hslZuHex(nh, ns * 0.7, 11), ink: hslZuHex(nh, ns * 0.5, 92), muted: hslZuHex(nh, ns * 0.4, 66), line: hslZuHex(nh, ns * 0.6, 23) }
    : { paper: hslZuHex(nh, ns, 97), grid: hslZuHex(nh, ns, 91), card: "#ffffff", ink: hslZuHex(nh, ns, 13), muted: hslZuHex(nh, ns * 0.5, 38), line: hslZuHex(nh, ns * 0.8, 85) };
  const accent = mitKontrast(basis, n.card, 4.5);
  const accentInk = kontrast("#ffffff", accent) >= kontrast(n.paper, accent) ? "#ffffff" : n.paper;
  const status = (hue: number, sat: number) => mitKontrast(hslZuHex(hue, sat, dunkel ? 62 : 32), n.card, 4.5);
  return { ...n, accent, accentInk, ok: status(145, 60), mid: status(36, 85), bad: status(4, 70), open: n.muted };
}

/* ---------------- Speichern (nur im Browser) ---------------- */
const SCHLUESSEL = "mt-darstellung-v1";
interface Speicher { aktiv: string; eigene: Stil[] }

function lies(): Speicher {
  try {
    const d = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "null");
    if (d && typeof d.aktiv === "string" && Array.isArray(d.eigene)) return { aktiv: d.aktiv, eigene: d.eigene.map(pruefeStil).filter(Boolean) as Stil[] };
  } catch { /* privater Modus o. Ä. */ }
  return { aktiv: "system", eigene: [] };
}
function schreib(s: Speicher): void {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(s)); } catch { /* ignorieren */ }
}

export function eigeneStile(): Stil[] { return lies().eigene; }
export function aktiveId(): string { return lies().aktiv; }
export function alleStile(): Stil[] { return [...VORLAGEN, ...lies().eigene]; }
export function stilMitId(id: string): Stil | undefined { return alleStile().find((x) => x.id === id); }

export function speichereEigenen(st: Stil): void {
  const s = lies();
  const i = s.eigene.findIndex((x) => x.id === st.id);
  const sauber = { ...st, eigen: true, name: st.name.slice(0, 40) || "Eigener Style" };
  if (i >= 0) s.eigene[i] = sauber; else s.eigene.push(sauber);
  s.eigene = s.eigene.slice(0, 30);
  schreib(s);
}
export function loescheEigenen(id: string): void {
  const s = lies();
  s.eigene = s.eigene.filter((x) => x.id !== id);
  if (s.aktiv === id) s.aktiv = "system";
  schreib(s);
}
export function waehle(id: string): void {
  const s = lies(); s.aktiv = id; schreib(s); wendeAktivAn();
}
export const neueId = () => "eigen-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------------- Teilen: Code zum Kopieren ---------------- */
const PRAEFIX = "MT-STYLE:";
export function exportCode(st: Stil): string {
  const json = JSON.stringify({ n: st.name, c: FARBEN.map((k) => st.farben[k].slice(1)).join(""), o: st.optionen });
  return PRAEFIX + btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}
export function importCode(code: string): Stil | null {
  try {
    const t = code.trim();
    if (!t.startsWith(PRAEFIX)) return null;
    const bytes = Uint8Array.from(atob(t.slice(PRAEFIX.length)), (ch) => ch.charCodeAt(0));
    const d = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof d.c !== "string" || !/^[0-9a-f]{72}$/i.test(d.c)) return null;
    const farben = Object.fromEntries(FARBEN.map((k, i) => ["" + k, "#" + d.c.slice(i * 6, i * 6 + 6).toLowerCase()])) as Farben;
    return pruefeStil({ id: neueId(), name: String(d.n ?? "Importiert"), farben, optionen: d.o, eigen: true });
  } catch { return null; }
}
function pruefeStil(x: unknown): Stil | null {
  if (!x || typeof x !== "object") return null;
  const s = x as Partial<Stil>;
  if (typeof s.id !== "string" || !s.farben) return null;
  const farben = {} as Farben;
  for (const k of FARBEN) { const h = normHex(String((s.farben as Farben)[k] ?? "")); if (!h) return null; farben[k] = h; }
  const o = (s.optionen ?? {}) as Partial<Optionen>;
  const optionen: Optionen = {
    radius: klemm(Number(o.radius ?? 10) || 0, 0, 24),
    raster: o.raster !== false,
    schrift: o.schrift === "serif" || o.schrift === "mono" ? o.schrift : "system",
    groesse: klemm(Number(o.groesse ?? 100) || 100, 85, 130),
  };
  return { id: s.id.slice(0, 40), name: String(s.name ?? "Eigener Style").slice(0, 40), farben, optionen, eigen: true };
}

/* ---------------- Anwenden ---------------- */
const SCHRIFTEN: Record<Schrift, string> = {
  system: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  mono: "ui-monospace,Menlo,Consolas,monospace",
};
const VAR: Record<FarbName, string> = {
  paper: "--paper", grid: "--grid", card: "--card", ink: "--ink", muted: "--muted", line: "--line",
  accent: "--accent", accentInk: "--accent-ink", ok: "--ok", mid: "--mid", bad: "--bad", open: "--open",
};

/** Setzt einen Style direkt auf <html> (auch für die Live-Vorschau im Editor) */
export function wendeAn(st: Stil): void {
  const r = document.documentElement, c = st.farben, dunkel = istDunkel(c.paper);
  for (const k of FARBEN) r.style.setProperty(VAR[k], c[k]);
  const anteil = dunkel ? 0.2 : 0.12;
  r.style.setProperty("--accent-soft", mische(c.accent, c.card, anteil));
  for (const k of ["ok", "mid", "bad", "open"] as const) r.style.setProperty(`--${k}-soft`, mische(c[k], c.card, anteil));
  r.style.setProperty("--r", st.optionen.radius + "px");
  r.style.setProperty("--f-ui", SCHRIFTEN[st.optionen.schrift]);
  r.style.setProperty("--grid-on", st.optionen.raster ? "1" : "0");
  r.style.fontSize = st.optionen.groesse + "%";
  r.dataset.theme = dunkel ? "dark" : "light";
  r.dataset.raster = st.optionen.raster ? "an" : "aus";
  r.style.colorScheme = dunkel ? "dark" : "light";
}

let systemHoerer: MediaQueryList | null = null;
/** Wendet den gespeicherten Style an; "system" folgt der Einstellung des Geräts */
export function wendeAktivAn(): void {
  const id = aktiveId();
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (id === "system") {
    wendeAn(stilMitId(mq?.matches ? "dunkel" : "hell")!);
    if (mq && !systemHoerer) { systemHoerer = mq; mq.addEventListener("change", () => { if (aktiveId() === "system") wendeAktivAn(); }); }
    return;
  }
  wendeAn(stilMitId(id) ?? VORLAGEN[0]);
}
