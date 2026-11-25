// Seite „Darstellung“: Styles wählen, eigene Styles bauen (Hex, RGB, Paletten-Generator), teilen und importieren.
import { el, toast } from "./ui";
import {
  FARBEN, FARB_LABEL, VORLAGEN, HARMONIE_LABEL,
  alleStile, eigeneStile, aktiveId, stilMitId, waehle, wendeAn, wendeAktivAn, speichereEigenen, loescheEigenen, neueId,
  exportCode, importCode, normHex, hexZuRgb, rgbZuHex, kontrast, palette, istDunkel,
  type Stil, type FarbName, type Harmonie, type Schrift, type RGB,
} from "./themes";

const kopie = (st: Stil): Stil => ({ ...st, farben: { ...st.farben }, optionen: { ...st.optionen } });

/** Mini-Vorschau eines Styles (rein aus seinen eigenen Farben, unabhängig vom aktiven Style) */
function vorschau(st: Stil): HTMLElement {
  const c = st.farben;
  return el("div", { class: "stil-vorschau", "aria-hidden": "true", style: `background:${c.paper};border-color:${c.line}` },
    el("div", { style: `background:${c.card};border:1px solid ${c.line};border-radius:${Math.min(st.optionen.radius, 8)}px` },
      el("span", { style: `color:${c.ink}` }, "Aa"),
      el("span", { style: `color:${c.muted}` }, "Text"),
      el("i", { style: `background:${c.accent}` })),
    el("div", { class: "stil-dots" }, ...(["ok", "mid", "bad", "open"] as const).map((k) => el("i", { style: `background:${c[k]}` }))));
}

export function renderDarstellung(view: HTMLElement): void {
  wendeAktivAn();
  const sec = el("div", { style: "display:flex;flex-direction:column;gap:16px" });

  /* ---------- 1) Styles wählen ---------- */
  const aktiv = aktiveId();
  const kachel = (id: string, name: string, st: Stil | null, eigen = false) => {
    const btn = el("button", { type: "button", class: "stil-kachel", "aria-pressed": String(aktiv === id), onclick: () => { waehle(id); renderDarstellung(view); toast("Style „" + name + "“ aktiv."); } },
      st ? vorschau(st) : el("div", { class: "stil-vorschau stil-system", "aria-hidden": "true" }, vorschau(VORLAGEN[0]), vorschau(VORLAGEN[1])),
      el("span", null, name), eigen ? el("small", { class: "muted" }, "eigener Style") : null);
    return btn;
  };
  const grid = el("div", { class: "stil-grid" },
    kachel("system", "Wie mein Gerät", null),
    ...VORLAGEN.map((s) => kachel(s.id, s.name, s)),
    ...eigeneStile().map((s) => kachel(s.id, s.name, s, true)));
  sec.append(el("section", { class: "card" },
    el("h2", null, "Darstellung"),
    el("p", { class: "muted small", style: "margin:0" }, "Wähl einen Style. „Wie mein Gerät“ folgt der Hell/Dunkel-Einstellung deines Systems. Die Auswahl wird nur in diesem Browser gespeichert."),
    grid,
    el("div", { class: "row" },
      el("button", { type: "button", class: "primary", onclick: () => {
        const startId = aktiv === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dunkel" : "hell") : aktiv;
        oeffneEditor(view, kopie({ ...(stilMitId(startId) ?? VORLAGEN[0]), id: neueId(), name: "Mein Style", eigen: true }));
      } }, "Eigenen Style bauen"))));

  /* ---------- 2) Eigene Styles verwalten ---------- */
  const eigene = eigeneStile();
  if (eigene.length) {
    const liste = el("div", { class: "list" });
    for (const s of eigene) {
      liste.append(el("div", null,
        el("div", { class: "row between" }, el("b", null, s.name), aktiv === s.id ? el("span", { class: "tag" }, "aktiv") : null),
        el("div", { class: "row" },
          el("button", { type: "button", class: "small-btn", onclick: () => oeffneEditor(view, kopie(s)) }, "Bearbeiten"),
          el("button", { type: "button", class: "small-btn", onclick: () => oeffneEditor(view, { ...kopie(s), id: neueId(), name: (s.name + " (Kopie)").slice(0, 40) }) }, "Duplizieren"),
          el("button", { type: "button", class: "small-btn", onclick: () => void kopiere(exportCode(s)) }, "Code kopieren"),
          el("button", { type: "button", class: "small-btn danger", onclick: () => { if (confirmLoeschen(s.name)) { loescheEigenen(s.id); wendeAktivAn(); renderDarstellung(view); } } }, "Löschen"))));
    }
    sec.append(el("section", { class: "card" }, el("h2", null, "Meine Styles"), liste));
  }

  /* ---------- 3) Importieren ---------- */
  const imp = el("textarea", { class: "short", id: "imp", placeholder: "MT-STYLE:…", spellcheck: "false" });
  sec.append(el("section", { class: "card" },
    el("h2", null, "Style importieren"),
    el("p", { class: "muted small", style: "margin:0" }, "Füg den Code ein, den jemand mit „Code kopieren“ geteilt hat."),
    imp,
    el("div", { class: "row" }, el("button", { type: "button", onclick: () => {
      const st = importCode(imp.value);
      if (!st) { toast("Der Code ist ungültig."); return; }
      speichereEigenen(st); waehle(st.id); renderDarstellung(view); toast("Style „" + st.name + "“ importiert.");
    } }, "Importieren"))));

  view.replaceChildren(sec);
}

function confirmLoeschen(name: string): boolean {
  // bewusst ohne Browser-Dialog: zweiter Klick innerhalb von 4 s bestätigt
  const jetzt = Date.now();
  if (letzteLoeschung && letzteLoeschung.name === name && jetzt - letzteLoeschung.t < 4000) { letzteLoeschung = null; return true; }
  letzteLoeschung = { name, t: jetzt };
  toast("Zum Löschen von „" + name + "“ noch einmal klicken.");
  return false;
}
let letzteLoeschung: { name: string; t: number } | null = null;

async function kopiere(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); toast("Code kopiert. Andere können ihn unter „Style importieren“ einfügen."); }
  catch { window.prompt?.("Code zum Kopieren:", text); }
}

/* ================= Editor ================= */
function oeffneEditor(view: HTMLElement, entwurf: Stil): void {
  let auswahl: FarbName = "accent";
  const vorschauAn = () => wendeAn(entwurf);
  vorschauAn();

  const name = el("input", { type: "text", id: "st-name", maxlength: 40, value: entwurf.name });
  name.addEventListener("input", () => { entwurf.name = name.value; });

  /* --- Palette (12 Farbfelder) --- */
  const leiste = el("div", { class: "swatches", role: "radiogroup", "aria-label": "Farbe zum Bearbeiten" });
  const zeichneLeiste = () => leiste.replaceChildren(...FARBEN.map((k) => el("button", {
    type: "button", class: "swatch", role: "radio", "aria-checked": String(k === auswahl), title: FARB_LABEL[k],
    onclick: () => { auswahl = k; zeichneLeiste(); fuelleRegler(); },
  }, el("i", { style: `background:${entwurf.farben[k]}` }), el("span", null, FARB_LABEL[k]))));

  /* --- Farbregler: Picker, Hex, RGB --- */
  const titel = el("h3", null);
  const picker = el("input", { type: "color", "aria-label": "Farbwähler" });
  const hex = el("input", { type: "text", class: "hex", maxlength: 7, spellcheck: "false", "aria-label": "Hex-Code" });
  const kan = ["R", "G", "B"].map((n) => ({
    range: el("input", { type: "range", min: 0, max: 255, step: 1, "aria-label": n }),
    zahl: el("input", { type: "number", min: 0, max: 255, class: "rgbzahl", "aria-label": n + " (0–255)" }),
    n,
  }));
  const setzeFarbe = (h: string, quelle?: string) => {
    entwurf.farben[auswahl] = h;
    if (quelle !== "picker") picker.value = h;
    if (quelle !== "hex") hex.value = h;
    const rgb = hexZuRgb(h);
    kan.forEach((k, i) => { if (quelle !== "r" + i) { k.range.value = String(rgb[i]); k.zahl.value = String(rgb[i]); } });
    const feld = leiste.querySelectorAll<HTMLElement>(".swatch i")[FARBEN.indexOf(auswahl)];
    if (feld) feld.style.background = h;
    vorschauAn(); pruefeKontrast();
  };
  const fuelleRegler = () => { titel.textContent = FARB_LABEL[auswahl]; setzeFarbe(entwurf.farben[auswahl]); };
  picker.addEventListener("input", () => setzeFarbe(picker.value, "picker"));
  hex.addEventListener("input", () => { const h = normHex(hex.value); hex.classList.toggle("ungueltig", !h); if (h && hex.value.replace("#", "").length >= 6) setzeFarbe(h, "hex"); });
  hex.addEventListener("change", () => { const h = normHex(hex.value); if (h) setzeFarbe(h); else { hex.value = entwurf.farben[auswahl]; hex.classList.remove("ungueltig"); } });
  kan.forEach((k, i) => {
    const neu = (v: string, von: "range" | "zahl") => {
      const rgb = hexZuRgb(entwurf.farben[auswahl]) as RGB;
      rgb[i] = Math.max(0, Math.min(255, Number(v) || 0));
      if (von === "range") k.zahl.value = String(rgb[i]); else k.range.value = String(rgb[i]);
      setzeFarbe(rgbZuHex(rgb), "r" + i);
    };
    k.range.addEventListener("input", () => neu(k.range.value, "range"));
    k.zahl.addEventListener("input", () => neu(k.zahl.value, "zahl"));
  });
  const regler = el("div", { class: "farbregler" },
    titel,
    el("div", { class: "row" }, picker, hex),
    ...kan.map((k) => el("div", { class: "rgbzeile" }, el("span", { class: "lbl" }, k.n), k.range, k.zahl)));

  /* --- Palette aus einer Farbe --- */
  const basis = el("input", { type: "color", value: entwurf.farben.accent, "aria-label": "Grundfarbe" });
  const basisHex = el("input", { type: "text", class: "hex", maxlength: 7, value: entwurf.farben.accent, "aria-label": "Grundfarbe als Hex" });
  basis.addEventListener("input", () => { basisHex.value = basis.value; });
  basisHex.addEventListener("change", () => { const h = normHex(basisHex.value); if (h) basis.value = basisHex.value = h; else basisHex.value = basis.value; });
  const modus = el("select", { "aria-label": "Hell oder dunkel" }, el("option", { value: "hell" }, "Hell"), el("option", { value: "dunkel" }, "Dunkel"));
  modus.value = istDunkel(entwurf.farben.paper) ? "dunkel" : "hell";
  const harmonie = el("select", { "aria-label": "Farbharmonie" }, ...Object.entries(HARMONIE_LABEL).map(([v, t]) => el("option", { value: v }, t)));
  const erzeuge = el("button", { type: "button", onclick: () => {
    entwurf.farben = palette(basis.value, modus.value === "dunkel", harmonie.value as Harmonie);
    zeichneLeiste(); fuelleRegler(); toast("Palette erzeugt. Du kannst jede Farbe noch anpassen.");
  } }, "Palette erzeugen");

  /* --- Optionen --- */
  const o = entwurf.optionen;
  const radius = el("input", { type: "range", min: 0, max: 24, step: 1, value: o.radius, "aria-label": "Eckenradius" });
  const radiusW = el("span", { class: "num" }, o.radius + " px");
  radius.addEventListener("input", () => { o.radius = Number(radius.value); radiusW.textContent = o.radius + " px"; vorschauAn(); });
  const groesse = el("input", { type: "range", min: 85, max: 130, step: 5, value: o.groesse, "aria-label": "Schriftgröße" });
  const groesseW = el("span", { class: "num" }, o.groesse + " %");
  groesse.addEventListener("input", () => { o.groesse = Number(groesse.value); groesseW.textContent = o.groesse + " %"; vorschauAn(); });
  const schrift = el("select", { id: "st-schrift" }, el("option", { value: "system" }, "Systemschrift"), el("option", { value: "serif" }, "Serifen"), el("option", { value: "mono" }, "Monospace"));
  schrift.value = o.schrift;
  schrift.addEventListener("change", () => { o.schrift = schrift.value as Schrift; vorschauAn(); });
  const raster = el("input", { type: "checkbox", id: "st-raster" });
  raster.checked = o.raster;
  raster.addEventListener("change", () => { o.raster = raster.checked; vorschauAn(); });

  /* --- Kontrastprüfung (WCAG) --- */
  const kontrastBox = el("div", { class: "kontrast" });
  const PAARE: [FarbName, FarbName, string, number][] = [
    ["ink", "paper", "Text auf Hintergrund", 4.5], ["ink", "card", "Text auf Karten", 4.5], ["muted", "card", "Gedämpfter Text", 4.5],
    ["accent", "card", "Akzent/Links auf Karten", 4.5], ["accentInk", "accent", "Text auf Akzent-Knöpfen", 4.5],
    ["ok", "card", "„Richtig“", 3], ["mid", "card", "„Teilweise“", 3], ["bad", "card", "„Fehler“", 3],
  ];
  function pruefeKontrast(): void {
    kontrastBox.replaceChildren(...PAARE.map(([a, b, t, ziel]) => {
      const k = kontrast(entwurf.farben[a], entwurf.farben[b]);
      const gut = k >= ziel;
      return el("div", { class: "row between kzeile" },
        el("span", null, el("i", { class: "kprobe", style: `background:${entwurf.farben[b]};color:${entwurf.farben[a]}` }, "Aa"), " ", t),
        el("span", { class: gut ? "k-ok" : "k-warn" }, k.toFixed(1) + " : 1 " + (gut ? "✓" : "– zu schwach (min. " + ziel + ")")));
    }));
  }

  /* --- Speichern / Abbrechen --- */
  const speichern = el("button", { type: "button", class: "primary", onclick: () => {
    entwurf.name = name.value.trim() || "Mein Style";
    speichereEigenen(entwurf); waehle(entwurf.id); renderDarstellung(view); toast("Style „" + entwurf.name + "“ gespeichert und aktiv.");
  } }, "Speichern und verwenden");
  const abbrechen = el("button", { type: "button", onclick: () => { wendeAktivAn(); renderDarstellung(view); } }, "Abbrechen");
  const basisWahl = el("select", { "aria-label": "Von Vorlage starten" }, el("option", { value: "" }, "Von Vorlage starten …"),
    ...alleStile().map((s) => el("option", { value: s.id }, s.name)));
  basisWahl.addEventListener("change", () => {
    const s = stilMitId(basisWahl.value); if (!s) return;
    entwurf.farben = { ...s.farben }; Object.assign(o, s.optionen);
    oeffneEditor(view, entwurf);
  });

  zeichneLeiste(); fuelleRegler(); pruefeKontrast();

  view.replaceChildren(el("div", { style: "display:flex;flex-direction:column;gap:16px" },
    el("section", { class: "card" },
      el("div", { class: "row between" }, el("h2", null, "Eigener Style"), basisWahl),
      el("p", { class: "muted small", style: "margin:0" }, "Die ganze Seite zeigt deine Änderungen sofort als Vorschau. Gespeichert wird erst mit „Speichern und verwenden“."),
      el("label", { for: "st-name" }, "Name"), name),
    el("section", { class: "card" },
      el("h2", null, "Farben"),
      el("p", { class: "muted small", style: "margin:0" }, "Feld antippen, dann per Farbwähler, Hex-Code oder RGB-Reglern ändern."),
      leiste, regler),
    el("section", { class: "card" },
      el("h2", null, "Palette aus einer Farbe"),
      el("p", { class: "muted small", style: "margin:0" }, "Erzeugt alle 12 Farben passend zu einer Grundfarbe. Die Kontraste werden dabei automatisch lesbar gehalten."),
      el("div", { class: "row" }, basis, basisHex),
      el("div", { class: "row gen" }, modus, harmonie, erzeuge)),
    el("section", { class: "card" },
      el("h2", null, "Form und Schrift"),
      el("div", { class: "optzeile" }, el("label", null, "Eckenradius"), radius, radiusW),
      el("div", { class: "optzeile" }, el("label", null, "Schriftgröße"), groesse, groesseW),
      el("div", { class: "optzeile" }, el("label", { for: "st-schrift" }, "Schrift"), schrift),
      el("label", { class: "row", for: "st-raster", style: "font-weight:400" }, raster, "Karoraster im Hintergrund")),
    el("section", { class: "card" },
      el("h2", null, "Lesbarkeit"),
      el("p", { class: "muted small", style: "margin:0" }, "Kontrast nach WCAG: Text sollte mindestens 4,5 : 1 haben."),
      kontrastBox),
    el("div", { class: "row" }, speichern, abbrechen)));
  window.scrollTo({ top: 0 });
}
