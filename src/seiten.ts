// Startseite, Konto, Admin-Ansicht, Datenschutz
import { el, toast, fmtDate, KAPITEL, kapName } from "./ui";
import { zustand, sendeFeedback, exportiereEigeneDaten, loescheKonto, ladeAdmin, setzeStatus, setzeAnzeigename, ladeStatistik, LIMIT_PRO_TAG, type Meldung, type FeedbackEintrag, type StatZeile } from "./daten";
import { supabase } from "./supabase";
import { VERANTWORTLICH_NAME, VERANTWORTLICH_KONTAKT, STAND_DATENSCHUTZ } from "./config";

/* ---------------- Startseite (angemeldet) ---------------- */
export function renderStart(view: HTMLElement): void {
  const now = Date.now();
  const faellig = Object.values(zustand.karten).filter((k) => k.faellig <= now).length;
  view.replaceChildren(
    el("section", { class: "card" },
      el("h2", null, "Willkommen beim Mathe-Trainer"),
      el("p", { style: "margin:0" }, "Übe die Inhalte von Mathe 1 (Kapitel 1–7, EL 1 und EL 2) so, wie es in der mündlichen Prüfung gefragt wird: in eigenen Worten."),
      el("div", { class: "tiles" },
        el("a", { class: "tile", href: "#wander" }, el("b", null, zustand.fragen.length), el("span", null, "Wanderfragen")),
        el("a", { class: "tile", href: "#erklaer" }, el("b", null, zustand.begriffe.length), el("span", null, "Begriffe erklären")),
        el("a", { class: "tile", href: "#verstehen" }, el("b", null, faellig), el("span", null, "Begriffe fällig")),
        el("a", { class: "tile", href: "#gruppe" }, el("b", null, "Live"), el("span", null, "Gruppenmodus")),
        el("a", { class: "tile", href: "#fortschritt" }, el("b", null, zustand.antworten.length), el("span", null, "deine Antworten")))),
    el("section", { class: "card" },
      el("h2", null, "Gut zu wissen"),
      el("ul", { style: "margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px" },
        el("li", null, "Der Prüfer gibt ", el("b", null, "keine Lösungen"), ", nur Tipps und eine Nachfrage. Unter „Verstehen“ erklärt dir ein Lern-Chat das Thema; einen Lösungsweg gibt es dort erst, wenn du danach fragst und vorher zweimal selbst probiert hast."),
        el("li", null, "Der Trainer passt sich dir an: Was noch nicht sitzt, kommt öfter wieder. Was du sicher kannst, kommt nur noch selten – stattdessen bekommst du dazu ab und zu eine neue, schwierigere Frage, die die KI nur für dich erzeugt."),
        el("li", null, "Das Feedback kommt von einer ", el("b", null, "KI"), " und kann Fehler enthalten. Prüfe Unsicheres mit deinen Unterlagen."),
        el("li", null, `Pro Tag hast du ${LIMIT_PRO_TAG} KI-Aufrufe für Prüfer, Lern-Chat und Gruppe zusammen (eine Antwort plus Nachfrage sind zwei).`),
        el("li", null, "Im Gruppenmodus beantwortet ihr eine Aufgabe gemeinsam, danach bekommt jede Person eine eigene Nachfrage – wie in der Gruppenprüfung."),
        el("li", null, "Schreib keine persönlichen Daten und keine Hausaufgaben in Antworten oder Chats. Sie werden an die KI geschickt (ohne deinen Namen oder deine E-Mail)."),
        el("li", null, "Deine Antworten und Chats sieht nur du. Auch der Betreiber sieht sie nicht."),
        el("li", null, "An gemeinsam genutzten Rechnern: nach dem Üben unter „Konto“ abmelden."),
        el("li", null, "Fehler in einer Frage oder eine falsche Bewertung? Unter jeder Frage gibt es „Frage oder Feedback melden“."))),
    el("div", { class: "row" }, el("a", { href: "#wander" }, el("button", { type: "button", class: "primary" }, "Wanderfrage-Runde starten"))));
}

/* ---------------- Konto ---------------- */
export function renderKonto(view: HTMLElement, email: string): void {
  const fbTa = el("textarea", { class: "short", id: "fb", maxlength: 2000, placeholder: "Was fehlt, was stört, was ist gut? (keine persönlichen Daten)" });
  const fbBtn = el("button", { type: "button", class: "primary" }, "Feedback senden");
  fbBtn.addEventListener("click", async () => {
    const t = fbTa.value.trim(); if (!t) { fbTa.focus(); return; }
    fbBtn.disabled = true;
    const ok = await sendeFeedback(t);
    toast(ok ? "Danke für dein Feedback!" : "Feedback konnte nicht gesendet werden.");
    if (ok) fbTa.value = "";
    fbBtn.disabled = false;
  });

  const exp = el("button", { type: "button" }, "Meine Daten herunterladen (JSON)");
  exp.addEventListener("click", async () => {
    exp.disabled = true;
    try {
      const blob = await exportiereEigeneDaten();
      const a = el("a", { href: URL.createObjectURL(blob), download: "mathe-trainer-daten.json" });
      document.body.append(a); a.click(); a.remove();
    } catch { toast("Export fehlgeschlagen."); }
    exp.disabled = false;
  });

  const raus = el("button", { type: "button" }, "Abmelden");
  raus.addEventListener("click", () => { void supabase?.auth.signOut(); });

  const bestaetigung = el("input", { type: "text", id: "del-ok", autocomplete: "off", placeholder: "LÖSCHEN" });
  const del = el("button", { type: "button", class: "danger" }, "Konto und alle Daten löschen");
  del.addEventListener("click", async () => {
    if (bestaetigung.value.trim() !== "LÖSCHEN") { toast("Bitte zur Bestätigung LÖSCHEN eintippen."); bestaetigung.focus(); return; }
    del.disabled = true;
    const ok = await loescheKonto();
    if (ok) { toast("Dein Konto und alle Daten wurden gelöscht."); location.hash = ""; }
    else { toast("Löschen fehlgeschlagen. Versuch es später noch einmal."); del.disabled = false; }
  });

  const nameIn = el("input", { type: "text", id: "anzeigename", maxlength: 30, value: zustand.anzeigename, placeholder: "z. B. Vorname" });
  const nameBtn = el("button", { type: "button" }, "Speichern");
  nameBtn.addEventListener("click", async () => {
    nameBtn.disabled = true;
    toast(await setzeAnzeigename(nameIn.value) ? "Anzeigename gespeichert." : "Bitte 1–30 Zeichen eingeben.");
    nameBtn.disabled = false;
  });

  view.replaceChildren(
    el("section", { class: "card" }, el("h2", null, "Konto"),
      el("p", { style: "margin:0" }, "Angemeldet als ", el("b", null, email)),
      el("div", { class: "row" }, raus)),
    el("section", { class: "card" }, el("h2", null, "Anzeigename für Gruppen"),
      el("p", { class: "muted small", style: "margin:0" }, "So sehen dich die anderen in Gruppenräumen. Im anonymen Admin-Überblick erscheint er nicht."),
      el("label", { for: "anzeigename" }, "Anzeigename"), nameIn, el("div", { class: "row" }, nameBtn)),
    el("section", { class: "card" }, el("h2", null, "Feedback zum Trainer"),
      el("label", { for: "fb" }, "Dein Feedback geht an den Betreiber"), fbTa, el("div", { class: "row" }, fbBtn)),
    el("section", { class: "card" }, el("h2", null, "Deine Daten"),
      el("p", { class: "muted", style: "margin:0" }, "Lade alle über dich gespeicherten Daten herunter: Antworten, Begriff-Einschätzungen, Chats, Meldungen, Feedback."),
      el("div", { class: "row" }, exp)),
    el("section", { class: "card" }, el("h2", null, "Konto löschen"),
      el("p", { class: "muted", style: "margin:0" }, "Löscht dein Konto, alle Antworten, Einschätzungen, Chats, Meldungen und dein Feedback sofort und endgültig. Das kann nicht rückgängig gemacht werden."),
      el("label", { for: "del-ok" }, "Zur Bestätigung LÖSCHEN eintippen"), bestaetigung,
      el("div", { class: "row" }, del)));
}

/* ---------------- Admin ---------------- */
const GRUND: Record<string, string> = {
  unklar: "unklar formuliert", fehlerhaft: "fachlich fehlerhaft", pruefer_falsch: "Prüfer falsch bewertet",
  loesung_verraten: "Lösung verraten", sonstiges: "sonstiges",
};

export async function renderAdmin(view: HTMLElement): Promise<void> {
  if (!zustand.istAdmin) { view.replaceChildren(el("p", { class: "muted" }, "Kein Zugriff.")); return; }
  view.replaceChildren(el("p", { class: "muted" }, "Lade Meldungen …"));
  let daten: { meldungen: Meldung[]; feedback: FeedbackEintrag[] };
  let statistik: StatZeile[] = [];
  try { [daten, statistik] = await Promise.all([ladeAdmin(), ladeStatistik().catch(() => [] as StatZeile[])]); }
  catch { view.replaceChildren(el("p", { class: "muted" }, "Laden fehlgeschlagen.")); return; }
  let sortKey: keyof StatZeile = "antworten", sortAuf = false;
  let filter = "offen";
  const fragen = Object.fromEntries(zustand.fragen.map((f) => [f.id, f.text]));
  const begriffe = Object.fromEntries(zustand.begriffe.map((b) => [b.id, b.begriff]));

  const statusKnoepfe = (tab: "meldungen" | "feedback", item: { id: string; status: string }) =>
    el("div", { class: "row" }, ...["offen", "erledigt", "abgelehnt"].map((s) => {
      const b = el("button", { type: "button", class: s === item.status ? "primary small" : "ghost small" }, s);
      b.addEventListener("click", async () => { if (await setzeStatus(tab, item.id, s)) { item.status = s; zeichne(); } else toast("Status konnte nicht gesetzt werden."); });
      return b;
    }));

  function zeichne() {
    const m = daten.meldungen.filter((x) => filter === "alle" || x.status === filter);
    const f = daten.feedback.filter((x) => filter === "alle" || x.status === filter);
    const sel = el("select", { "aria-label": "Filter" }, ...["offen", "erledigt", "abgelehnt", "alle"].map((s) => el("option", { value: s, selected: s === filter }, s)));
    sel.addEventListener("change", () => { filter = sel.value; zeichne(); });
    view.replaceChildren(
      el("section", { class: "card" }, el("h2", null, "Admin"),
        el("p", { class: "muted small", style: "margin:0" }, "Meldungen und Feedback sind ohne Namen und E-Mail. Antworten der Nutzer sind hier bewusst nicht sichtbar."),
        el("div", { class: "row" }, el("label", null, "Status ", sel))),
      scoreboard(),
      el("section", { class: "card" }, el("h2", null, `Meldungen (${m.length})`),
        m.length ? el("div", { class: "list" }, ...m.map((x) => el("div", { class: "admin-item" },
          el("div", { class: "row" }, el("span", { class: "tag" }, x.frage_id), el("span", { class: "trap" }, GRUND[x.grund] ?? x.grund), el("span", { class: "muted small" }, fmtDate(Date.parse(x.erstellt_am)))),
          el("span", { class: "small" }, fragen[x.frage_id] ?? begriffe[x.frage_id] ?? "(freies Thema)"),
          x.text ? el("p", { style: "margin:0" }, x.text) : null,
          statusKnoepfe("meldungen", x)))) : el("p", { class: "muted", style: "margin:0" }, "Keine Einträge.")),
      el("section", { class: "card" }, el("h2", null, `Feedback (${f.length})`),
        f.length ? el("div", { class: "list" }, ...f.map((x) => el("div", { class: "admin-item" },
          el("span", { class: "muted small" }, fmtDate(Date.parse(x.erstellt_am))),
          el("p", { style: "margin:0;white-space:pre-wrap" }, x.text),
          statusKnoepfe("feedback", x)))) : el("p", { class: "muted", style: "margin:0" }, "Keine Einträge.")));
  }
  function scoreboard(): HTMLElement {
    const sp: [keyof StatZeile, string][] = [["nutzer", "Nutzer"], ["antworten", "Antw."], ["richtig_prozent", "% richtig"], ["antworten_7_tage", "7 Tage"],
      ["gruppen_antworten", "Gruppe"], ["chats", "Chats"], ["ki_7_tage", "KI 7 T."], ["letzte_aktivitaet", "zuletzt"]];
    const zahl = (v: unknown) => (v === null || v === undefined ? -1 : typeof v === "number" ? v : Number(v) || String(v));
    const zeilen = [...statistik].sort((a, b) => {
      const x = zahl(a[sortKey]), y = zahl(b[sortKey]);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "de", { numeric: true });
      return sortAuf ? c : -c;
    });
    const aktiv7 = statistik.filter((s) => Number(s.antworten_7_tage) > 0).length;
    const summe = (k: keyof StatZeile) => statistik.reduce((t, s) => t + (Number(s[k]) || 0), 0);
    const kopf = el("tr", null, ...sp.map(([k, t]) => el("th", null, el("button", { type: "button", class: "th-btn", "aria-sort": sortKey === k ? (sortAuf ? "ascending" : "descending") : "none",
      onclick: () => { if (sortKey === k) sortAuf = !sortAuf; else { sortKey = k; sortAuf = k === "nutzer"; } zeichne(); } }, t + (sortKey === k ? (sortAuf ? " ▲" : " ▼") : "")))),
      el("th", null, "Lernstand Kap. 1–7, EL 1–2"));
    const tab = el("table", { class: "stats" }, el("thead", null, kopf), el("tbody", null, ...zeilen.map((s) => el("tr", null,
      el("td", null, s.nutzer), el("td", null, s.antworten), el("td", null, s.richtig_prozent ?? "–"), el("td", null, s.antworten_7_tage),
      el("td", null, s.gruppen_antworten), el("td", null, s.chats), el("td", null, s.ki_7_tage),
      el("td", null, s.letzte_aktivitaet ? new Date(s.letzte_aktivitaet).toLocaleDateString("de-DE") : "–"),
      el("td", null, el("span", { class: "mini-ls" }, ...KAPITEL.map((k) => { const p = Number(s.lernstand?.[k] ?? 0); return el("i", { style: `--p:${p}`, title: kapName(k) + ": " + p + " %" }); })))))));
    return el("section", { class: "card" }, el("h2", null, "Überblick (anonym)"),
      el("div", { class: "tiles" },
        el("div", { class: "tile" }, el("b", null, statistik.length), el("span", null, "Konten")),
        el("div", { class: "tile" }, el("b", null, aktiv7), el("span", null, "aktiv in 7 Tagen")),
        el("div", { class: "tile" }, el("b", null, summe("antworten")), el("span", null, "Antworten gesamt")),
        el("div", { class: "tile" }, el("b", null, summe("ki_7_tage")), el("span", null, "KI-Aufrufe 7 Tage"))),
      el("p", { class: "muted small", style: "margin:0" }, "Ohne Namen und E-Mail. „Nutzer N“ ist eine feste Nummer nach Anmeldedatum. Antworttexte sind hier nie sichtbar. Spalte anklicken zum Sortieren."),
      el("div", { class: "chartbox" }, tab));
  }
  zeichne();
}

/* ---------------- Datenschutz ---------------- */
export function renderDatenschutz(view: HTMLElement): void {
  const fehlt = !VERANTWORTLICH_NAME || !VERANTWORTLICH_KONTAKT;
  const h = (t: string) => el("h3", null, t);
  const p = (...k: (string | Node)[]) => el("p", null, ...k);
  view.replaceChildren(el("section", { class: "card prose" },
    el("h2", null, "Datenschutz"),
    fehlt ? el("div", { class: "notice warn" }, "Die Angaben zum Verantwortlichen werden gerade ergänzt.") : null,
    h("Wer ist verantwortlich?"),
    p("Der Mathe-Trainer ist ein privates, kostenloses Lernangebot für einen kleinen, eingeladenen Kreis. Es ist kein Angebot einer Hochschule oder eines Unternehmens."),
    p("Verantwortlich: ", VERANTWORTLICH_NAME || "–", el("br"), "Kontakt: ", VERANTWORTLICH_KONTAKT || "–"),
    h("Welche Daten werden gespeichert?"),
    el("ul", null,
      el("li", null, "Deine E-Mail-Adresse (für Einladung und Anmeldung)."),
      el("li", null, "Deine Übungsdaten: Antworten, Bewertungen des Prüfers, Einschätzungen zu Begriffen."),
      el("li", null, "Deine Verständnis-Chats (Nachrichten an den Lern-Chat und dessen Antworten), bis du sie oder dein Konto löschst."),
      el("li", null, "Neue Übungsfragen, die die KI nur für dich erzeugt hat (zu Fragen, die du sicher beherrschst)."),
      el("li", null, "Wenn du den Gruppenmodus nutzt: dein selbst gewählter Anzeigename, deine Gruppenräume mit der gemeinsamen Antwort (werden 7 Tage nach der letzten Aktivität gelöscht) und dein Lernstand in Prozent pro Kapitel."),
      el("li", null, "Meldungen und Feedback, die du selbst abschickst (ohne Namen)."),
      el("li", null, "Ein Tageszähler für die Prüfer-Aufrufe (wird nach spätestens 7 Tagen gelöscht)."),
      el("li", null, "Technisch beim Seitenaufruf: IP-Adresse und Zeitpunkt in den Server-Protokollen der Dienstleister (siehe unten).")),
    p("Es gibt keine Werbung, kein Tracking und keine Analyse-Tools. Im Browser werden nur die Anmeldung (damit du angemeldet bleibst) und deine gewählte Darstellung bzw. eigene Styles gespeichert (Local Storage). Die Styles werden nicht übertragen."),
    h("Wozu?"),
    p("Ausschließlich, um dir den Trainer bereitzustellen: Anmeldung, Speichern deines Lernstands, Bewertung deiner Antworten durch den KI-Prüfer, Bearbeitung deiner Meldungen."),
    h("Wer sieht deine Daten?"),
    el("ul", null,
      el("li", null, "Deine Antworten, Einschätzungen und Chats sieht nur du. Der Betreiber sieht sie nicht (technisch durch Zugriffsregeln in der Datenbank abgesichert)."),
      el("li", null, "Mitglieder eines gemeinsamen Gruppenraums sehen deinen Anzeigenamen, die gemeinsame Antwort, ob du deine Nachfrage beantwortet hast und deinen Lernstand pro Kapitel. Deine Einzelnachfrage, deine Antwort darauf und deren Bewertung sehen sie nicht."),
      el("li", null, "Der Betreiber sieht einen anonymen Überblick (z. B. „Nutzer 7“: Anzahl Antworten, Anteil richtig, Lernstand pro Kapitel, KI-Aufrufe, letzte Aktivität) – ohne Namen, E-Mail und ohne Antworttexte."),
      el("li", null, "Der Betreiber sieht Meldungen und Feedback (ohne Namen) sowie in der Nutzerverwaltung deine E-Mail-Adresse.")),
    h("Dienstleister"),
    el("ul", null,
      el("li", null, el("b", null, "Supabase"), " (Datenbank und Anmeldung), Rechenzentrum Frankfurt am Main."),
      el("li", null, el("b", null, "GitHub Pages"), " (Auslieferung der Webseite). Dabei werden IP-Adressen verarbeitet, auch außerhalb der EU."),
      el("li", null, el("b", null, "Brevo"), " (Versand der Einladungs- und Login-Mails). Dafür wird deine E-Mail-Adresse übermittelt."),
      el("li", null, el("b", null, "Anthropic"), " (KI-Prüfer, USA). Übermittelt werden nur Fragetext, deine Antworten und deine Chat-Nachrichten, ", el("b", null, "nicht"), " deine E-Mail-Adresse oder Nutzerkennung. Anthropic löscht diese Daten nach eigenen Angaben standardmäßig innerhalb von 30 Tagen.")),
    h("Wie lange?"),
    p("Bis du dein Konto löschst. Das geht jederzeit selbst unter „Konto“ und entfernt sofort alle deine Daten. Der Tageszähler wird nach spätestens 7 Tagen gelöscht."),
    h("Deine Rechte"),
    p("Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Auskunft und Löschung kannst du direkt unter „Konto“ selbst ausführen. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren."),
    el("p", { class: "muted small" }, "Stand: " + STAND_DATENSCHUTZ),
    el("p", null, el("a", { href: "#" }, "Zurück"))));
}
