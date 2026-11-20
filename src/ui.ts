// Gemeinsame UI-Helfer und Konstanten (übernommen aus dem Mathe-1-Trainer)

export const FEHLERTYPEN: Record<string, string> = {
  impl_richtung: "A ⇒ B mit B ⇒ A verwechselt",
  quantoren: "Quantorenreihenfolge",
  induktion_konkret: "Konkretes n im Induktionsschritt",
  beispiel_beweis: "All-Aussage per Beispiel „bewiesen“",
  definitionsbereich: "Definitionsbereich/Zielmenge ignoriert",
  oder_vereinigung: "∨ und ∪ verwechselt",
  n_vs_n0: "ℕ und ℕ₀ verwechselt",
  mod_kongruenz: "mod-Rechnung und Kongruenz verwechselt",
  vor_beh: "Voraussetzung/Behauptung nicht getrennt",
  begriff_unpraezise: "Begriff ungenau oder unvollständig",
  begruendung_fehlt: "Begründung fehlt",
  rechenfehler: "Rechenfehler",
  luecke: "Wissenslücke",
};

export const FORMATE: Record<string, string> = {
  erklaere: "Erkläre",
  rechnung: "Kurzrechnung",
  janein: "Ja/Nein + Begründung",
  anwendung: "Anwendung",
  alltag: "Alltagslogik",
  verknuepfung: "Verknüpfung",
};

export const KAT_LABEL: Record<string, string> = { richtig: "richtig", teilweise: "teilweise", fehler: "Fehler", offen: "offen" };
export const KAPITEL = [1, 2, 3, 4, 5, 6, 7];
export const DAY = 86400000;

type Kind = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> | null;

/** Kleines DOM-Hilfsmittel: el("div", {class: "x", onclick: fn}, "Text", kind) */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...kids: (Kind | Kind[])[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v as EventListener);
    else if (k === "text") n.textContent = String(v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
  return n;
}

export function toast(msg: string): void {
  const t = el("div", { class: "toast", role: "status" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3800);
}

export const kapLabel = (k: number[]) => k.map((v) => "Kap. " + v).join(" + ");

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "x";
}

/* Optionale Symbolleiste: fügt Zeichen an der Cursorposition ein */
const SYMBOLE = ["∈", "∉", "⊂", "∩", "∪", "\\", "∅", "∀", "∃", "¬", "∧", "∨", "⇒", "⇔", "≠", "≤", "≥", "ℕ", "ℕ₀", "ℤ", "ℚ", "ℝ", "ℂ", "⌊ ⌋", "⌈ ⌉", "∑", "∏", "√", "²", "∘", "↦", "→", "≡", "|"];
export function symbolBar(ta: HTMLTextAreaElement): HTMLElement {
  const wrap = el("details", { class: "symbols" }, el("summary", null, "Symbole einfügen (optional)"));
  const grid = el("div", { class: "symgrid" });
  for (const s of SYMBOLE) {
    const b = el("button", { type: "button", class: "sym", "aria-label": "Symbol " + s + " einfügen" }, s);
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      const pair = s.includes(" ");
      const ins = pair ? s.replace(" ", "") : s;
      const start = ta.selectionStart ?? ta.value.length, end = ta.selectionEnd ?? ta.value.length;
      ta.setRangeText(ins, start, end, "end");
      if (pair) ta.selectionStart = ta.selectionEnd = start + 1;
      ta.focus();
    });
    grid.append(b);
  }
  wrap.append(grid, el("p", { class: "muted small", style: "margin:6px 0 0" }, "Du musst keine Symbole benutzen. Klartext wie „A geschnitten B“, „=>“ oder „abgerundet“ zählt genauso."));
  return wrap;
}
