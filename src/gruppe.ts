// Gruppenmodus: Raum per Code, gemeinsame Antwort live, KI-Bewertung, danach eine EIGENE Nachfrage pro Person.
// Sichtbar für die Gruppe: Anzeigenamen, gemeinsame Antwort, Gruppenbewertung, „beantwortet“-Status,
// Lernstand pro Kapitel. Nicht sichtbar: Einzelnachfragen, Einzelantworten, Einzelbewertungen.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { el, toast, kapLabel, KAPITEL, KAT_LABEL, FEHLERTYPEN, FORMATE } from "./ui";
import {
  zustand, LIMIT_PRO_TAG, setzeAnzeigename, raumErstellen, raumBeitreten, raumVerlassen, raumNaechste, ladeRaum, ladeRaumStatus,
  eigeneNachfrage, meineRaeume, schreibeGruppenAntwort, gruppeKI, holeGruppenAntwort, type RaumMitglied, type Frage,
} from "./daten";

const FEHLER_TEXT: Record<string, string> = {
  raum_unbekannt: "Diesen Raum gibt es nicht (oder er ist älter als 24 Stunden).",
  raum_voll: "Der Raum ist voll (max. 6 Personen).",
  zu_viele_raeume: "Du hast heute schon sehr viele Räume erstellt. Nutz einen bestehenden.",
  frage_unbekannt: "Diese Frage gibt es nicht mehr.",
  runde_laeuft: "Erst die laufende Runde abschließen.",
  schon_abgegeben: "Die Antwort wurde schon abgegeben.",
  antwort_leer: "Schreibt erst eine gemeinsame Antwort.",
  limit: `Dein Tageslimit (${LIMIT_PRO_TAG} KI-Aufrufe) ist erreicht. Jemand anderes aus der Gruppe kann abgeben.`,
  pruefer_nicht_erreichbar: "Der Prüfer ist gerade nicht erreichbar. Versucht es gleich noch einmal.",
};
const fehlerText = (f?: string) => (f && FEHLER_TEXT[f]) || "Das hat nicht geklappt (" + (f ?? "Netz") + ").";

let kanal: RealtimeChannel | null = null;
export function kanalSchliessen(): void { if (kanal && supabase) void supabase.removeChannel(kanal); kanal = null; }

function zufallsFrage(kap: number[]): Frage | undefined {
  const pool = zustand.fragen.filter((f) => !kap.length || f.kapitel.some((k) => kap.includes(k)));
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ================= Lobby ================= */
export async function renderGruppe(view: HTMLElement): Promise<void> {
  const id = new URLSearchParams(location.hash.split("?")[1] ?? "").get("raum");
  if (id) { await zeigeRaum(view, id); return; }
  kanalSchliessen();

  // 1) Anzeigename (Pflicht für Gruppen)
  if (!zustand.anzeigename) {
    const name = el("input", { type: "text", id: "anzeigename", maxlength: 30, placeholder: "z. B. Jason" });
    const ok = el("button", { type: "submit", class: "primary" }, "Speichern");
    const form = el("form", { class: "card" },
      el("h2", null, "Gruppenmodus"),
      el("p", { class: "muted", style: "margin:0" }, "Wie sollen dich die anderen in Gruppenräumen sehen? Vorname oder Spitzname reicht. Du kannst ihn später unter „Konto“ ändern."),
      el("label", { for: "anzeigename" }, "Anzeigename"), name, el("div", { class: "row" }, ok));
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); ok.disabled = true;
      if (await setzeAnzeigename(name.value)) void renderGruppe(view); else { toast("Bitte 1–30 Zeichen eingeben."); ok.disabled = false; }
    });
    view.replaceChildren(form); name.focus(); return;
  }

  // 2) Raum erstellen
  const kapWahl = el("div", { class: "vlpick" }, ...KAPITEL.map((k) => el("label", null, el("input", { type: "checkbox", value: String(k) }), "Kap. " + k)));
  const erstellen = el("button", { type: "button", class: "primary" }, "Raum erstellen");
  erstellen.addEventListener("click", async () => {
    const kap = [...kapWahl.querySelectorAll<HTMLInputElement>("input:checked")].map((i) => Number(i.value));
    const f = zufallsFrage(kap); if (!f) { toast("Keine Fragen für diese Auswahl."); return; }
    erstellen.disabled = true;
    const r = await raumErstellen(f.id);
    erstellen.disabled = false;
    if (r.id) location.hash = "#gruppe?raum=" + r.id; else toast(fehlerText(r.fehler));
  });

  // 3) Beitreten
  const code = el("input", { type: "text", class: "code", id: "raumcode", maxlength: 6, autocomplete: "off", placeholder: "ABC234", style: "text-transform:uppercase" });
  const beitreten = el("button", { type: "submit" }, "Beitreten");
  const beitrittForm = el("form", { class: "card" },
    el("h2", null, "Raum beitreten"),
    el("label", { for: "raumcode" }, "Code aus der Gruppe"), code, el("div", { class: "row" }, beitreten));
  beitrittForm.addEventListener("submit", async (e) => {
    e.preventDefault(); beitreten.disabled = true;
    const r = await raumBeitreten(code.value);
    beitreten.disabled = false;
    if (r.id) location.hash = "#gruppe?raum=" + r.id; else toast(fehlerText(r.fehler));
  });

  const sec = el("div", { style: "display:flex;flex-direction:column;gap:16px" },
    el("section", { class: "card" },
      el("h2", null, "Gruppenmodus"),
      el("p", { style: "margin:0" }, "Wie in der Gruppenprüfung: Ihr beantwortet eine Aufgabe gemeinsam (alle tippen live im selben Feld). Der Prüfer bewertet eure Antwort und stellt danach ", el("b", null, "jeder Person eine eigene Nachfrage"), "."),
      el("p", { class: "muted small", style: "margin:0" }, `Die Gruppe sieht eure gemeinsame Antwort, ob die anderen ihre Nachfrage beantwortet haben und euren Lernstand pro Kapitel. Eure Einzelnachfragen und deren Bewertung sieht nur ihr selbst. Jede Abgabe zählt aufs Tageslimit der Person, die abgibt.`),
      el("h3", null, "Kapitel für die Aufgabe (leer = alle)"), kapWahl,
      el("div", { class: "row" }, erstellen, el("span", { class: "muted small" }, "Du bist " + zustand.anzeigename))),
    beitrittForm);
  view.replaceChildren(sec);

  const alt = await meineRaeume();
  const frisch = alt.filter((r) => Date.now() - Date.parse(r.aktiv_am) < 24 * 3600e3);
  if (frisch.length) sec.append(el("section", { class: "card" }, el("h2", null, "Deine offenen Räume"),
    el("div", { class: "list" }, ...frisch.map((r) => el("div", null, el("div", { class: "row between" },
      el("span", { class: "tag" }, r.code), el("a", { href: "#gruppe?raum=" + r.id }, "Öffnen")))))));
}

/* ================= Raum ================= */
async function zeigeRaum(view: HTMLElement, id: string): Promise<void> {
  kanalSchliessen();
  let raum = await ladeRaum(id);
  if (!raum) { view.replaceChildren(el("div", { class: "notice warn" }, "Raum nicht gefunden oder du bist kein Mitglied. ", el("a", { href: "#gruppe" }, "Zur Übersicht"))); return; }
  let mitglieder: RaumMitglied[] = await ladeRaumStatus(id);
  let ich = "";
  try { ich = (await supabase!.auth.getUser()).data.user?.id ?? ""; } catch { /* ignorieren */ }

  // --- feste Bausteine ---
  const kopf = el("section", { class: "card" });
  const aufgabe = el("section", { class: "card" });
  const ta = el("textarea", { id: "gruppen-antwort", maxlength: 4000, placeholder: "Gemeinsame Antwort – alle können hier schreiben …" });
  const schreibtInfo = el("span", { class: "muted small" });
  const abgeben = el("button", { type: "button", class: "primary" }, "Gemeinsam abgeben");
  const ergebnis = el("div", { style: "display:flex;flex-direction:column;gap:10px" });
  const lernstand = el("section", { class: "card" });
  view.replaceChildren(el("div", { style: "display:flex;flex-direction:column;gap:16px" }, kopf, aufgabe, lernstand));

  // --- Live-Schreiben (letzter Stand gewinnt; kurze Verzögerung, damit nicht jeder Tastendruck gesendet wird) ---
  let timer: number | undefined, tippeSeit = 0, gesendet = raum.antwort;
  ta.value = raum.antwort;
  ta.addEventListener("input", () => {
    tippeSeit = Date.now();
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => { gesendet = ta.value; await schreibeGruppenAntwort(id, ta.value); }, 500);
  });

  abgeben.addEventListener("click", async () => {
    window.clearTimeout(timer);
    if (ta.value !== gesendet) { gesendet = ta.value; await schreibeGruppenAntwort(id, ta.value); }
    if (ta.value.trim().length < 3) { toast(fehlerText("antwort_leer")); return; }
    abgeben.disabled = true; abgeben.textContent = "Prüfer liest gründlich … (ca. 10–20 s)";
    const r = await gruppeKI({ aktion: "bewerten", raumId: id });
    abgeben.textContent = "Gemeinsam abgeben";
    if (r.fehler) { abgeben.disabled = false; toast(fehlerText(r.fehler)); }
    await aktualisieren();
  });

  // --- Zeichnen ---
  function name(uid: string | null): string { return mitglieder.find((m) => m.user_id === uid)?.anzeigename ?? "jemand"; }

  function zeichneKopf(): void {
    const kopieren = el("button", { type: "button", class: "small-btn", onclick: async () => {
      try { await navigator.clipboard.writeText(raum!.code); toast("Code kopiert."); } catch { toast("Code: " + raum!.code); }
    } }, "Code kopieren");
    const raus = el("button", { type: "button", class: "small-btn", onclick: async () => { await raumVerlassen(id); kanalSchliessen(); location.hash = "#gruppe"; } }, "Raum verlassen");
    kopf.replaceChildren(
      el("div", { class: "row between" }, el("h2", null, "Gruppenraum"), el("span", { class: "raumcode", "aria-label": "Raum-Code" }, raum!.code)),
      el("div", { class: "row" }, ...mitglieder.map((m) => el("span", { class: "chip" + (raum!.phase === "nachfragen" || raum!.phase === "fertig" ? (m.beantwortet ? " on" : "") : "") },
        m.anzeigename + (m.user_id === ich ? " (du)" : "") + ((raum!.phase === "nachfragen" || raum!.phase === "fertig") && m.hat_nachfrage ? (m.beantwortet ? " ✓" : " …") : "")))),
      el("p", { class: "muted small", style: "margin:0" }, "Teil den Code mit deiner Gruppe (max. 6 Personen). Runde " + raum!.runde + "."),
      el("div", { class: "row" }, kopieren, raus));
  }

  function zeichneLernstand(): void {
    const tab = el("table", { class: "lstab" },
      el("thead", null, el("tr", null, el("th", null, ""), ...KAPITEL.map((k) => el("th", null, "K" + k)))),
      el("tbody", null, ...mitglieder.map((m) => el("tr", null, el("th", null, m.anzeigename),
        ...KAPITEL.map((k) => { const p = Number(m.lernstand?.[k] ?? 0); return el("td", { style: `--p:${p}`, title: p + " %" }, p ? String(p) : "–"); })))));
    lernstand.replaceChildren(el("h2", null, "Lernstand der Gruppe"),
      el("p", { class: "muted small", style: "margin:0" }, "Prozent „sicher“ pro Kapitel – hilft beim Aufteilen, wer was erklärt."),
      el("div", { class: "chartbox" }, tab));
  }

  async function zeichneAufgabe(): Promise<void> {
    const f = zustand.fragen.find((x) => x.id === raum!.frage_id);
    const kopfzeile = el("div", { class: "tags" }, el("span", { class: "tag" }, f ? kapLabel(f.kapitel) : ""), el("span", { class: "tag plain" }, f ? FORMATE[f.format] ?? f.format : ""));
    const frage = el("p", { class: "question" }, f?.text ?? "(Frage wird geladen …)");
    const teile: (Node | null)[] = [kopfzeile, frage];

    if (raum!.phase === "sammeln" || raum!.phase === "bewerten") {
      ta.readOnly = raum!.phase !== "sammeln";
      abgeben.disabled = raum!.phase !== "sammeln";
      if (raum!.phase === "bewerten") abgeben.textContent = "Prüfer liest gründlich … (ca. 10–20 s)";
      teile.push(el("label", { for: "gruppen-antwort" }, "Eure gemeinsame Antwort"), ta, schreibtInfo, el("div", { class: "row" }, abgeben));
    } else {
      const b = raum!.bewertung;
      teile.push(el("h3", null, "Eure gemeinsame Antwort"), el("p", { class: "msg-text", style: "margin:0" }, raum!.antwort));
      if (b) teile.push(el("div", { class: "fb " + b.kategorie },
        el("div", { class: "row" }, el("span", { class: "pill " + b.kategorie }, KAT_LABEL[b.kategorie] ?? b.kategorie),
          ...b.fehlertypen.map((t) => el("span", { class: "trap" }, FEHLERTYPEN[t] ?? t))),
        el("p", { style: "margin:0" }, b.tipp)));
      teile.push(ergebnis);
      await zeichneNachfrage();
    }
    aufgabe.replaceChildren(el("h2", null, "Gruppenaufgabe"), ...teile.filter(Boolean) as Node[]);
  }

  let eigeneFb: { kategorie: string; tipp: string } | null = null;
  async function zeichneNachfrage(): Promise<void> {
    const n = await eigeneNachfrage(id, raum!.runde);
    if (!n) { ergebnis.replaceChildren(el("p", { class: "muted", style: "margin:0" }, "Du bist erst nach der Abgabe beigetreten – für dich gibt es in dieser Runde keine Nachfrage.")); }
    else if (!n.beantwortet) {
      const t2 = el("textarea", { class: "short", id: "einzel", maxlength: 2000, placeholder: "Deine eigene Antwort (nur du und der Prüfer sehen sie)" });
      const senden = el("button", { type: "button", class: "primary" }, "Nachfrage beantworten");
      senden.addEventListener("click", async () => {
        if (!t2.value.trim()) { t2.focus(); return; }
        senden.disabled = true; senden.textContent = "Prüfer liest gründlich … (ca. 10–20 s)";
        const r = await gruppeKI({ aktion: "nachfrage", raumId: id, antwort: t2.value });
        if (r.feedback) { eigeneFb = r.feedback; await holeGruppenAntwort(id + ":" + raum!.runde); await aktualisieren(); }
        else { senden.disabled = false; senden.textContent = "Nachfrage beantworten"; toast(fehlerText(r.fehler)); }
      });
      ergebnis.replaceChildren(el("div", { class: "card nachfrage-karte" },
        el("h3", null, "Deine Nachfrage (nur für dich)"), el("p", { class: "followup" }, n.nachfrage),
        el("label", { for: "einzel" }, "Deine Antwort"), t2, el("div", { class: "row" }, senden)));
    } else {
      const fb = eigeneFb ?? letzteEigeneBewertung();
      ergebnis.replaceChildren(el("div", { class: "card nachfrage-karte" },
        el("h3", null, "Deine Nachfrage (nur für dich)"), el("p", { class: "followup" }, n.nachfrage),
        fb ? el("div", { class: "fb " + fb.kategorie }, el("div", { class: "row" }, el("span", { class: "pill " + fb.kategorie }, KAT_LABEL[fb.kategorie] ?? fb.kategorie)), el("p", { style: "margin:0" }, fb.tipp))
          : el("p", { class: "muted small", style: "margin:0" }, "Beantwortet. Deine Bewertung findest du unter „Fortschritt“.")));
    }
    if (raum!.phase === "fertig") {
      const naechste = el("button", { type: "button", class: "primary" }, "Nächste Aufgabe");
      naechste.addEventListener("click", async () => {
        const f = zufallsFrage(zustand.fragen.find((x) => x.id === raum!.frage_id)?.kapitel ?? []);
        if (!f) return;
        naechste.disabled = true;
        const fe = await raumNaechste(id, f.id);
        if (fe) { naechste.disabled = false; toast(fehlerText(fe)); }
        eigeneFb = null; await aktualisieren();
      });
      ergebnis.append(el("div", { class: "row" }, naechste, el("span", { class: "muted small" }, "Alle haben geantwortet.")));
    } else if (n?.beantwortet) {
      ergebnis.append(el("p", { class: "muted small", style: "margin:0" }, "Warte auf die anderen …"));
    }
  }
  function letzteEigeneBewertung(): { kategorie: string; tipp: string } | null {
    const a = [...zustand.antworten].reverse().find((x) => x.modus === "gruppe" && x.runde_id === id + ":" + raum!.runde);
    return a ? { kategorie: a.kategorie_nachfrage, tipp: a.tipp_nachfrage } : null;
  }

  // --- Neu laden (nach Realtime-Ereignis oder eigener Aktion) ---
  let alteRunde = raum.runde, altePhase = raum.phase;
  async function aktualisieren(): Promise<void> {
    if (!location.hash.includes(id)) return;
    const neu = await ladeRaum(id);
    if (!neu) return;
    raum = neu;
    mitglieder = await ladeRaumStatus(id);
    // Text nur übernehmen, wenn ich gerade nicht selbst tippe
    if (raum.antwort !== ta.value && Date.now() - tippeSeit > 1500) { ta.value = raum.antwort; gesendet = raum.antwort; }
    schreibtInfo.textContent = raum.antwort_von && raum.antwort_von !== ich && raum.antwort_am && Date.now() - Date.parse(raum.antwort_am) < 5000
      ? name(raum.antwort_von) + " schreibt …" : "";
    zeichneKopf(); zeichneLernstand();
    if (raum.runde !== alteRunde || raum.phase !== altePhase || raum.phase !== "sammeln" || !aufgabe.childElementCount) {
      alteRunde = raum.runde; altePhase = raum.phase;
      await zeichneAufgabe();
    }
  }

  // --- Realtime ---
  let geplant: number | undefined;
  const spaeter = () => { window.clearTimeout(geplant); geplant = window.setTimeout(() => void aktualisieren(), 150); };
  if (supabase) {
    kanal = supabase.channel("raum-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "raeume", filter: "id=eq." + id }, spaeter)
      .on("postgres_changes", { event: "*", schema: "public", table: "raum_mitglieder", filter: "raum_id=eq." + id }, spaeter)
      .on("postgres_changes", { event: "*", schema: "public", table: "raum_nachfragen", filter: "raum_id=eq." + id }, spaeter)
      .subscribe();
  }
  // Fallback, falls Realtime blockiert ist (z. B. Firmen-WLAN): alle 8 s nachsehen
  const poll = window.setInterval(() => { if (!location.hash.includes(id)) { window.clearInterval(poll); kanalSchliessen(); return; } void aktualisieren(); }, 8000);

  zeichneKopf(); zeichneLernstand(); await zeichneAufgabe();
}
