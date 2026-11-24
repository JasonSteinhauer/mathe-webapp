// Frage-Antwort-Ablauf (gemeinsam für Wanderfragen und Erklär's mir)
import { el, toast, symbolBar, kapLabel, FORMATE, FEHLERTYPEN, KAT_LABEL } from "./ui";
import { niveauFuer } from "./lernstand";
import { pruefe, speichereAntwort, aktualisiereAntwort, meldeFrage, LIMIT_PRO_TAG, zustand, type Antwort, type Feedback, type NeueAntwort } from "./daten";

export type QaKontext = {
  modus: "wander" | "erklaer";
  rundeId?: string | null;
  frageId: string;            // Frage-ID, Begriff-ID oder "frei-<slug>"
  begriffId?: string;
  freiesThema?: string;
  kapitel: number[];
  format: string;
  frage: string;
  begriff?: string;
  kopf?: string;
  weiterText?: string;
};

function fehlerText(code?: string): string {
  switch (code) {
    case "limit": return `Du hast heute alle ${LIMIT_PRO_TAG} Prüfer-Aufrufe genutzt. Morgen geht es weiter. Deine Antwort ist gespeichert.`;
    case "nicht_angemeldet": return "Deine Anmeldung ist abgelaufen. Lade die Seite neu und melde dich an.";
    case "nicht_konfiguriert": return "Der Prüfer ist noch nicht eingerichtet. Deine Antwort ist gespeichert.";
    default: return "Der Prüfer ist gerade nicht erreichbar. Deine Antwort ist gespeichert.";
  }
}

function fbBlock(kat: string, typen: string[], tipp: string): HTMLElement {
  const b = el("div", { class: "fb " + kat });
  b.append(el("div", { class: "row" }, el("span", { class: "pill " + kat }, KAT_LABEL[kat] || kat), ...typen.map((t) => el("span", { class: "trap" }, FEHLERTYPEN[t] ?? t))));
  if (tipp) b.append(el("p", { style: "margin:0" }, tipp));
  return b;
}

/** Formular „Frage melden“ (klappt auf) */
export function meldenBox(frageId: string): HTMLElement {
  const box = el("details", { class: "melden" }, el("summary", { class: "muted small" }, "Frage oder Feedback melden"));
  const sel = el("select", { "aria-label": "Grund" },
    el("option", { value: "unklar" }, "Frage ist unklar formuliert"),
    el("option", { value: "fehlerhaft" }, "Frage ist fachlich fehlerhaft"),
    el("option", { value: "pruefer_falsch" }, "Prüfer hat falsch bewertet"),
    el("option", { value: "loesung_verraten" }, "Prüfer hat die Lösung verraten"),
    el("option", { value: "sonstiges" }, "Sonstiges"));
  const ta = el("textarea", { class: "short", placeholder: "Optional: Was genau? (keine persönlichen Daten)", maxlength: 1000 });
  const send = el("button", { type: "button" }, "Meldung senden");
  send.addEventListener("click", async () => {
    send.disabled = true;
    const ok = await meldeFrage(frageId, sel.value, ta.value.trim());
    toast(ok ? "Danke, die Meldung ist angekommen." : "Meldung konnte nicht gesendet werden.");
    if (ok) { box.open = false; ta.value = ""; }
    send.disabled = false;
  });
  box.append(el("div", { class: "melden" }, sel, ta, el("div", { class: "row" }, send)));
  return box;
}

export function qaFlow(ctx: QaKontext, onDone: (rec: Antwort | NeueAntwort) => void): HTMLElement {
  const box = el("div", { class: "card" });
  const tags = el("div", { class: "tags" }, el("span", { class: "tag" }, kapLabel(ctx.kapitel)), el("span", { class: "tag plain" }, FORMATE[ctx.format] ?? ctx.format));
  box.append(ctx.kopf ? el("div", { class: "row between" }, tags, el("span", { class: "muted small" }, ctx.kopf)) : tags);
  if (ctx.begriff) box.append(el("p", { class: "term" }, ctx.begriff));
  box.append(el("p", { class: "question" }, ctx.frage));
  const taId = "a-" + Date.now();
  const ta = el("textarea", { id: taId, maxlength: 2000, placeholder: "Antworte so, wie du es in der Prüfung sagen würdest: in ganzen Sätzen." });
  const send = el("button", { type: "button", class: "primary" }, "Antwort abgeben");
  const idk = el("button", { type: "button", class: "ghost" }, "Weiß ich nicht");
  const out = el("div", { class: "hidden" });
  box.append(el("label", { for: taId }, "Deine Antwort"), ta, symbolBar(ta), el("div", { class: "row" }, send, idk), out,
    el("p", { class: "muted small", style: "margin:0" }, `Prüfer heute: ${zustand.kiHeute} von ${LIMIT_PRO_TAG} Aufrufen genutzt.`),
    meldenBox(ctx.frageId));

  let gespeichert: Antwort | null = null;
  let rec: NeueAntwort;
  let fb1: Feedback | null = null;

  async function abgabe(text: string) {
    send.disabled = idk.disabled = true; ta.readOnly = true;
    out.classList.remove("hidden");
    out.replaceChildren(el("p", { class: "muted" }, "Der Prüfer liest deine Antwort gründlich … (ca. 10–20 Sekunden)"));
    rec = {
      modus: ctx.modus, runde_id: ctx.rundeId ?? null, frage_id: ctx.frageId, kapitel: ctx.kapitel, format: ctx.format,
      frage: ctx.frage, antwort: text, weiss_nicht: !text, kategorie: "offen", fehlertypen: [], tipp: "", nachfrage: "",
      antwort_nachfrage: "", kategorie_nachfrage: "", fehlertypen_nachfrage: [], tipp_nachfrage: "", zu_viel_verraten: false, quelle: "offline",
    };
    const r = await pruefe({ modus: ctx.modus, frageId: ctx.modus === "wander" ? ctx.frageId : undefined, begriffId: ctx.begriffId, freiesThema: ctx.freiesThema, antwort: text, phase: 1,
      niveau: ctx.modus === "wander" ? niveauFuer(ctx.frageId) : "basis" });
    fb1 = r.feedback ?? null;
    if (fb1) Object.assign(rec, { kategorie: fb1.kategorie, fehlertypen: fb1.fehlertypen, tipp: fb1.tipp, nachfrage: fb1.nachfrage, quelle: "claude" });
    gespeichert = await speichereAntwort(rec);
    if (!gespeichert) toast("Speichern fehlgeschlagen. Die Antwort bleibt nur bis zum Neuladen sichtbar.");
    renderFb1(r.fehler);
  }

  function leakBtn(): HTMLElement {
    const b = el("button", { type: "button", class: "ghost small" }, "Hat zu viel verraten");
    b.addEventListener("click", async () => {
      b.disabled = true;
      if (gespeichert) await aktualisiereAntwort(gespeichert.id, { zu_viel_verraten: true });
      b.textContent = "Gemerkt, danke";
    });
    return b;
  }

  function fertig(where: HTMLElement) {
    where.append(el("div", { class: "row", style: "margin-top:12px" },
      el("button", { type: "button", class: "primary", onclick: () => onDone(gespeichert ?? rec) }, ctx.weiterText || "Weiter"),
      fb1 ? leakBtn() : null));
  }

  function renderFb1(fehler?: string) {
    out.replaceChildren();
    if (!fb1) { out.append(el("div", { class: "fb" }, el("p", { style: "margin:0" }, fehlerText(fehler)))); fertig(out); return; }
    out.append(fbBlock(fb1.kategorie, fb1.fehlertypen, fb1.tipp));
    if (!fb1.nachfrage) { fertig(out); return; }
    const nId = "n-" + Date.now();
    const ta2 = el("textarea", { id: nId, class: "short", maxlength: 2000, placeholder: "Deine Antwort auf die Nachfrage" });
    const s2 = el("button", { type: "button", class: "primary" }, "Nachfrage beantworten");
    const skip = el("button", { type: "button", class: "ghost" }, "Überspringen");
    const out2 = el("div");
    out.append(el("div", { class: "card", style: "margin-top:12px;padding:14px;gap:10px" },
      el("h3", null, "Nachfrage des Prüfers"), el("p", { class: "followup" }, fb1.nachfrage),
      el("label", { for: nId }, "Deine Antwort"), ta2, symbolBar(ta2), el("div", { class: "row" }, s2, skip), out2));
    skip.addEventListener("click", () => { s2.disabled = skip.disabled = true; ta2.readOnly = true; fertig(out2); });
    s2.addEventListener("click", async () => {
      const t2 = ta2.value.trim(); if (!t2) { ta2.focus(); return; }
      s2.disabled = skip.disabled = true; ta2.readOnly = true;
      out2.replaceChildren(el("p", { class: "muted" }, "Der Prüfer liest gründlich … (ca. 10–20 Sekunden)"));
      const f1 = fb1!;
      const r2 = await pruefe({
        modus: ctx.modus, frageId: ctx.modus === "wander" ? ctx.frageId : undefined, begriffId: ctx.begriffId, freiesThema: ctx.freiesThema,
        antwort: rec.antwort, phase: 2, vorher: { kategorie: f1.kategorie, tipp: f1.tipp, nachfrage: f1.nachfrage, antwortNachfrage: t2 },
      });
      const patch: Partial<NeueAntwort> = { antwort_nachfrage: t2 };
      if (r2.feedback) Object.assign(patch, { kategorie_nachfrage: r2.feedback.kategorie, fehlertypen_nachfrage: r2.feedback.fehlertypen, tipp_nachfrage: r2.feedback.tipp });
      if (gespeichert) await aktualisiereAntwort(gespeichert.id, patch);
      Object.assign(rec, patch);
      out2.replaceChildren(r2.feedback ? fbBlock(r2.feedback.kategorie, r2.feedback.fehlertypen, r2.feedback.tipp) : el("p", { class: "muted" }, fehlerText(r2.fehler)));
      fertig(out2);
    });
  }

  send.addEventListener("click", () => { const t = ta.value.trim(); if (!t) { ta.focus(); toast("Schreib zuerst eine Antwort."); return; } void abgabe(t); });
  idk.addEventListener("click", () => void abgabe(""));
  setTimeout(() => ta.focus({ preventScroll: true }), 0);
  return box;
}
