// Übungsansichten: Wanderfragen, Erklär's mir, Glossar-Karten (Leitner)
import { el, shuffle, slugify, kapLabel, KAPITEL, KAT_LABEL, DAY } from "./ui";
import { zustand, speichereKarte, type Antwort, type NeueAntwort, type Frage, type Begriff, type Karte } from "./daten";
import { qaFlow } from "./qa";

type Rec = Antwort | NeueAntwort;

function letzteProFrage(): Record<string, Antwort> {
  const m: Record<string, Antwort> = {};
  for (const a of zustand.antworten) { const p = m[a.frage_id]; if (!p || a.ts > p.ts) m[a.frage_id] = a; }
  return m;
}

/* ---------------- Wanderfragen ---------------- */
let runde: { id: string; fragen: Frage[]; i: number; ergebnisse: Rec[] } | null = null;

function waehleRunde(kap: Set<number>, n: number): Frage[] {
  const last = letzteProFrage();
  const pool = zustand.fragen.filter((q) => q.kapitel.some((v) => kap.has(v))).map((q) => {
    const l = last[q.id]; let s = Math.random();
    if (!l) s += 0.6; else if (l.kategorie === "fehler") s += 0.9; else if (l.kategorie === "teilweise" || l.kategorie === "offen") s += 0.5;
    else if (Date.now() - l.ts < 3 * DAY) s -= 0.4;
    return { q, s };
  }).sort((a, b) => b.s - a.s);
  const proKap: Record<number, number> = {}, proF: Record<string, number> = {};
  const maxKap = Math.max(2, Math.ceil(n / kap.size) + 1), maxF = 4, pick: Frage[] = [];
  for (const { q } of pool) {
    if (pick.length >= n) break;
    const v = q.kapitel[0];
    if ((proKap[v] || 0) >= maxKap || (proF[q.format] || 0) >= maxF) continue;
    pick.push(q); proKap[v] = (proKap[v] || 0) + 1; proF[q.format] = (proF[q.format] || 0) + 1;
  }
  for (const { q } of pool) { if (pick.length >= n) break; if (!pick.includes(q)) pick.push(q); }
  return shuffle(pick);
}

export function renderWander(view: HTMLElement): void {
  if (runde && runde.i < runde.fragen.length) return renderWanderFrage(view);
  if (runde) return renderWanderEnde(view);
  const sel = new Set(KAPITEL);
  const picks = el("div", { class: "vlpick", role: "group", "aria-label": "Kapitel" });
  const start = el("button", { type: "button", class: "primary" }, "Runde starten (10 Fragen)");
  for (const v of KAPITEL) {
    const id = "kap-" + v;
    const cb = el("input", { type: "checkbox", id, checked: true });
    cb.addEventListener("change", () => { if (cb.checked) sel.add(v); else sel.delete(v); start.disabled = sel.size === 0; });
    picks.append(el("label", { for: id }, cb, "Kap. " + v));
  }
  start.addEventListener("click", () => { runde = { id: "r-" + Date.now(), fragen: waehleRunde(sel, 10), i: 0, ergebnisse: [] }; renderWander(view); });
  const last = letzteProFrage();
  const offen = zustand.fragen.filter((q) => last[q.id] && last[q.id].kategorie !== "richtig").length;
  view.replaceChildren(el("section", { class: "card" },
    el("h2", null, "Wanderfrage-Runde"),
    el("p", { class: "muted", style: "margin:0" }, "10 gemischte Fragen aus den gewählten Kapiteln. Nach jeder Antwort gibt der Prüfer einen Tipp und stellt eine Nachfrage. Fragen, die zuletzt falsch oder nur teilweise richtig waren, kommen öfter dran."),
    el("div", { class: "row small muted" }, el("span", null, zustand.fragen.length + " Fragen im Pool"), el("span", null, "·"), el("span", null, offen + " noch nicht sicher")),
    el("div", null, el("h3", { style: "margin-bottom:8px" }, "Kapitel"), picks),
    el("div", { class: "row" }, start)));
}

function renderWanderFrage(view: HTMLElement): void {
  const r = runde!;
  const q = r.fragen[r.i];
  const pct = Math.round((r.i / r.fragen.length) * 100);
  const abbruch = el("button", { type: "button", class: "ghost small" }, "Runde beenden");
  abbruch.addEventListener("click", () => { r.fragen = r.fragen.slice(0, r.i); renderWander(view); });
  view.replaceChildren(
    el("div", { class: "row between", style: "margin-bottom:10px" }, el("div", { class: "progressbar", style: "flex:1;min-width:120px" }, el("span", { style: "width:" + pct + "%" })), abbruch),
    qaFlow({ modus: "wander", rundeId: r.id, frageId: q.id, kapitel: q.kapitel, format: q.format, frage: q.text,
      kopf: "Frage " + (r.i + 1) + " von " + r.fragen.length, weiterText: r.i + 1 < r.fragen.length ? "Nächste Frage" : "Runde auswerten" },
    (rec) => { r.ergebnisse.push(rec); r.i++; renderWander(view); window.scrollTo({ top: 0 }); }));
}

function renderWanderEnde(view: HTMLElement): void {
  const e = runde!.ergebnisse;
  const z = (k: string) => e.filter((r) => r.kategorie === k).length;
  const list = el("div", { class: "list" });
  e.forEach((r, i) => list.append(el("div", null,
    el("div", { class: "row" }, el("span", { class: "pill " + r.kategorie }, KAT_LABEL[r.kategorie]), el("span", { class: "tag" }, kapLabel(r.kapitel)),
      r.kategorie_nachfrage ? el("span", { class: "muted small" }, "Nachfrage: " + KAT_LABEL[r.kategorie_nachfrage]) : null),
    el("span", { class: "small" }, i + 1 + ". " + r.frage))));
  const neu = el("button", { type: "button", class: "primary" }, "Neue Runde");
  neu.addEventListener("click", () => { runde = null; renderWander(view); });
  view.replaceChildren(el("section", { class: "card" },
    el("h2", null, "Runde beendet"),
    e.length ? el("div", { class: "tiles" },
      el("div", { class: "tile" }, el("b", null, z("richtig")), el("span", null, "richtig")),
      el("div", { class: "tile" }, el("b", null, z("teilweise")), el("span", null, "teilweise")),
      el("div", { class: "tile" }, el("b", null, z("fehler")), el("span", null, "Fehler")),
      el("div", { class: "tile" }, el("b", null, z("offen")), el("span", null, "ohne Feedback"))) : el("p", { class: "muted" }, "Keine Fragen beantwortet."),
    list,
    el("div", { class: "row" }, neu, el("a", { href: "#fortschritt" }, "Zum Fortschritt"))));
}

/* ---------------- Erklär's mir ---------------- */
let erklaerBegriff: (Begriff & { frei?: boolean }) | null = null;

function schwacheBegriffe(): Begriff[] {
  const now = Date.now();
  return zustand.begriffe.map((g) => {
    const c = zustand.karten[g.id];
    return { g, s: (c ? c.stufe : 0.5) + Math.random() * 0.8 + (c && c.faellig <= now ? -0.5 : 0) };
  }).sort((a, b) => a.s - b.s).map((x) => x.g);
}

export function setzeErklaerBegriff(b: Begriff | null): void { erklaerBegriff = b; }

export function renderErklaer(view: HTMLElement): void {
  if (erklaerBegriff) return renderErklaerFrage(view);
  const dl = el("datalist", { id: "gl-list" }, ...zustand.begriffe.map((g) => el("option", { value: g.begriff }, "Kap. " + g.kapitel)));
  const inp = el("input", { type: "text", id: "begriff-in", list: "gl-list", maxlength: 120, placeholder: "z. B. Äquivalenzrelation", autocomplete: "off" });
  const go = el("button", { type: "button", class: "primary" }, "Erklären");
  const rnd = el("button", { type: "button" }, "Schwachen Begriff vorschlagen");
  go.addEventListener("click", () => {
    const v = inp.value.trim(); if (!v) { inp.focus(); return; }
    const g = zustand.begriffe.find((x) => x.begriff.toLowerCase() === v.toLowerCase());
    erklaerBegriff = g ?? { id: "frei-" + slugify(v), begriff: v, kapitel: 0, frei: true };
    renderErklaer(view);
  });
  rnd.addEventListener("click", () => { erklaerBegriff = schwacheBegriffe()[0] ?? null; renderErklaer(view); });
  view.replaceChildren(el("section", { class: "card" },
    el("h2", null, "Erklär's mir"),
    el("p", { class: "muted", style: "margin:0" }, "Erkläre einen Begriff oder eine Beweisidee frei, wie in der mündlichen Prüfung. Der Prüfer bewertet Vollständigkeit und Präzision und hakt einmal nach."),
    el("label", { for: "begriff-in" }, "Begriff aus dem Glossar oder eigenes Thema"), inp, dl,
    el("div", { class: "row" }, go, rnd)));
}

function renderErklaerFrage(view: HTMLElement): void {
  const g = erklaerBegriff!;
  const kapitel = g.frei ? KAPITEL.slice() : [g.kapitel];
  const zur = el("button", { type: "button", class: "ghost small" }, "Anderen Begriff wählen");
  zur.addEventListener("click", () => { erklaerBegriff = null; renderErklaer(view); });
  view.replaceChildren(
    el("div", { class: "row between", style: "margin-bottom:10px" }, el("span", { class: "muted small" }, g.frei ? "Eigenes Thema" : "Glossar · Kap. " + g.kapitel), zur),
    qaFlow({ modus: "erklaer", frageId: g.id, begriffId: g.frei ? undefined : g.id, freiesThema: g.frei ? g.begriff : undefined,
      kapitel, format: "erklaere", begriff: g.begriff,
      frage: "Erkläre „" + g.begriff + "“ in eigenen Worten: Was bedeutet es, wie schreibt man es, ein Beispiel, ein Gegenbeispiel und wozu braucht man es?",
      weiterText: "Nächster Begriff" },
    () => { erklaerBegriff = null; renderErklaer(view); window.scrollTo({ top: 0 }); }));
}

/* ---------------- Glossar-Karten (Leitner: 1/2/4/8/16 Tage) ---------------- */
const INTERVALLE = [1, 2, 4, 8, 16];
let kartenQueue: Begriff[] | null = null, kartenIdx = 0;

export function naechsteStufe(alt: number, bewertung: "sicher" | "unsicher" | "keine"): number {
  if (bewertung === "sicher") return Math.min(5, alt ? alt + 1 : 1);
  if (bewertung === "unsicher") return Math.max(1, alt);
  return 1;
}

export function renderKarten(view: HTMLElement): void {
  const now = Date.now();
  const due = zustand.begriffe.filter((g) => zustand.karten[g.id] && zustand.karten[g.id].faellig <= now).sort((a, b) => zustand.karten[a.id].stufe - zustand.karten[b.id].stufe);
  const neu = zustand.begriffe.filter((g) => !zustand.karten[g.id]);
  if (!kartenQueue || kartenIdx >= kartenQueue.length) {
    const stufen = [0, 0, 0, 0, 0];
    Object.values(zustand.karten).forEach((c) => { if (c.stufe >= 1 && c.stufe <= 5) stufen[c.stufe - 1]++; });
    const start = el("button", { type: "button", class: "primary" }, due.length ? "Fällige Karten lernen (" + Math.min(due.length + Math.min(neu.length, 10), 30) + ")" : neu.length ? "Neue Karten lernen (10)" : "Alles erledigt");
    start.disabled = !due.length && !neu.length;
    start.addEventListener("click", () => { kartenQueue = due.concat(shuffle(neu.slice()).slice(0, 10)).slice(0, 30); kartenIdx = 0; renderKarten(view); });
    view.replaceChildren(el("section", { class: "card" },
      el("h2", null, "Glossar-Karten"),
      el("p", { class: "muted", style: "margin:0" }, "Auf der Karte steht nur der Begriff. Erkläre ihn dir selbst und schätze dich dann ehrlich ein. „Sicher“ schiebt die Karte eine Stufe weiter (1, 2, 4, 8, 16 Tage), „keine Ahnung“ setzt sie auf Stufe 1 zurück."),
      el("div", { class: "tiles" },
        el("div", { class: "tile" }, el("b", null, due.length), el("span", null, "heute fällig")),
        el("div", { class: "tile" }, el("b", null, neu.length), el("span", null, "noch nie gelernt")),
        el("div", { class: "tile" }, el("b", null, Object.keys(zustand.karten).length), el("span", null, "im Kasten")),
        el("div", { class: "tile" }, el("b", null, stufen[4]), el("span", null, "auf Stufe 5"))),
      el("div", { class: "row" }, start)));
    return;
  }
  const g = kartenQueue[kartenIdx];
  const c = zustand.karten[g.id];
  const rate = (bew: "sicher" | "unsicher" | "keine") => async () => {
    const stufe = naechsteStufe(c ? c.stufe : 0, bew);
    const t = Date.now();
    const verlauf = (c?.verlauf ?? []).slice(-29).concat([{ ts: t, bewertung: bew }]);
    const k: Karte = { karte_id: g.id, begriff: g.begriff, kapitel: g.kapitel, stufe, faellig: t + INTERVALLE[stufe - 1] * DAY, letzte: t, verlauf };
    await speichereKarte(k);
    kartenIdx++; renderKarten(view);
  };
  const ta = el("textarea", { class: "short", id: "k-" + g.id, placeholder: "Optional: Schreib deine Erklärung. Sie wird nicht gespeichert und nicht bewertet." });
  view.replaceChildren(el("section", { class: "card" },
    el("div", { class: "row between" }, el("div", { class: "tags" }, el("span", { class: "tag" }, "Kap. " + g.kapitel), el("span", { class: "tag plain" }, c ? "Stufe " + c.stufe : "neu")), el("span", { class: "muted small" }, "Karte " + (kartenIdx + 1) + " von " + kartenQueue.length)),
    el("p", { class: "term" }, g.begriff),
    el("label", { for: "k-" + g.id }, "Deine Erklärung"), ta,
    el("div", { class: "row" }, el("a", { href: "#erklaer", onclick: () => setzeErklaerBegriff(g) }, "Mit dem Prüfer üben")),
    el("h3", null, "Wie sicher warst du?"),
    el("div", { class: "row" },
      el("button", { type: "button", class: "primary", onclick: rate("sicher") }, "Sicher"),
      el("button", { type: "button", onclick: rate("unsicher") }, "Unsicher"),
      el("button", { type: "button", onclick: rate("keine") }, "Keine Ahnung"))));
}
