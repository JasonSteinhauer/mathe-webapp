// Übungsansichten: Wanderfragen, Erklär's mir, Glossar-Karten (Leitner)
import { el, slugify, kapLabel, KAPITEL, KAT_LABEL } from "./ui";
import { zustand, type Antwort, type NeueAntwort, type Frage, type Begriff } from "./daten";
import { waehleRunde, kapitelSicherheit } from "./lernstand";
import { oeffneChatZuAntwort } from "./verstehen";
import { qaFlow } from "./qa";

type Rec = Antwort | NeueAntwort;

function letzteProFrage(): Record<string, Antwort> {
  const m: Record<string, Antwort> = {};
  for (const a of zustand.antworten) { const p = m[a.frage_id]; if (!p || a.ts > p.ts) m[a.frage_id] = a; }
  return m;
}

/* ---------------- Wanderfragen ---------------- */
let runde: { id: string; fragen: Frage[]; i: number; ergebnisse: Rec[] } | null = null;

export function renderWander(view: HTMLElement): void {
  if (runde && runde.i < runde.fragen.length) return renderWanderFrage(view);
  if (runde) return renderWanderEnde(view);
  const sel = new Set(KAPITEL);
  const sicher = kapitelSicherheit();
  const picks = el("div", { class: "vlpick", role: "group", "aria-label": "Kapitel" });
  const start = el("button", { type: "button", class: "primary" }, "Runde starten (10 Fragen)");
  for (const v of KAPITEL) {
    const id = "kap-" + v;
    const cb = el("input", { type: "checkbox", id, checked: true });
    cb.addEventListener("change", () => { if (cb.checked) sel.add(v); else sel.delete(v); start.disabled = sel.size === 0; });
    picks.append(el("label", { for: id, title: "Sicherheit in diesem Kapitel" }, cb, "Kap. " + v, el("span", { class: "muted small" }, " " + sicher[v].prozent + " %")));
  }
  start.addEventListener("click", () => { runde = { id: "r-" + Date.now(), fragen: waehleRunde(sel, 10), i: 0, ergebnisse: [] }; renderWander(view); });
  const last = letzteProFrage();
  const offen = zustand.fragen.filter((q) => last[q.id] && last[q.id].kategorie !== "richtig").length;
  view.replaceChildren(el("section", { class: "card" },
    el("h2", null, "Wanderfrage-Runde"),
    el("p", { class: "muted", style: "margin:0" }, "10 Fragen, angepasst an deinen Lernstand: Schwache Kapitel und Fragen, die noch nicht sitzen, kommen öfter, bis du sie zweimal mit Abstand richtig hattest. Sichere Themen kommen seltener, dafür mit anspruchsvolleren Nachfragen. Die Prozentzahl zeigt, wie sicher du im Kapitel bist."),
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
    el("span", { class: "small" }, i + 1 + ". " + r.frage),
    "id" in r && r.kategorie !== "richtig" ? el("div", { class: "row" }, el("button", { type: "button", class: "small", onclick: () => oeffneChatZuAntwort(r as Antwort) }, "Im Chat verstehen")) : null)));
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

