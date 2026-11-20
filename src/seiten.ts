// Startseite, Konto, Admin-Ansicht, Datenschutz
import { el, toast, fmtDate } from "./ui";
import { zustand, sendeFeedback, exportiereEigeneDaten, loescheKonto, ladeAdmin, setzeStatus, LIMIT_PRO_TAG, type Meldung, type FeedbackEintrag } from "./daten";
import { supabase } from "./supabase";
import { VERANTWORTLICH_NAME, VERANTWORTLICH_KONTAKT, STAND_DATENSCHUTZ } from "./config";

/* ---------------- Startseite (angemeldet) ---------------- */
export function renderStart(view: HTMLElement): void {
  const now = Date.now();
  const faellig = Object.values(zustand.karten).filter((k) => k.faellig <= now).length;
  view.replaceChildren(
    el("section", { class: "card" },
      el("h2", null, "Willkommen beim Mathe-Trainer"),
      el("p", { style: "margin:0" }, "Übe die Inhalte von Mathe 1 (Kapitel 1–7) so, wie es in der mündlichen Prüfung gefragt wird: in eigenen Worten."),
      el("div", { class: "tiles" },
        el("a", { class: "tile", href: "#wander" }, el("b", null, zustand.fragen.length), el("span", null, "Wanderfragen")),
        el("a", { class: "tile", href: "#erklaer" }, el("b", null, zustand.begriffe.length), el("span", null, "Begriffe erklären")),
        el("a", { class: "tile", href: "#karten" }, el("b", null, faellig), el("span", null, "Karten fällig")),
        el("a", { class: "tile", href: "#fortschritt" }, el("b", null, zustand.antworten.length), el("span", null, "deine Antworten")))),
    el("section", { class: "card" },
      el("h2", null, "Gut zu wissen"),
      el("ul", { style: "margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px" },
        el("li", null, "Der Trainer enthält ", el("b", null, "keine Lösungen"), ". Der Prüfer gibt Tipps und stellt eine Nachfrage."),
        el("li", null, "Das Feedback kommt von einer ", el("b", null, "KI"), " und kann Fehler enthalten. Prüfe Unsicheres mit deinen Unterlagen."),
        el("li", null, `Pro Tag hast du ${LIMIT_PRO_TAG} Prüfer-Aufrufe (eine Antwort plus Nachfrage sind zwei).`),
        el("li", null, "Schreib keine persönlichen Daten in deine Antworten. Sie werden zur Bewertung an die KI geschickt (ohne deinen Namen oder deine E-Mail)."),
        el("li", null, "Deine Antworten und Karten sieht nur du. Auch der Betreiber sieht sie nicht."),
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

  view.replaceChildren(
    el("section", { class: "card" }, el("h2", null, "Konto"),
      el("p", { style: "margin:0" }, "Angemeldet als ", el("b", null, email)),
      el("div", { class: "row" }, raus)),
    el("section", { class: "card" }, el("h2", null, "Feedback zum Trainer"),
      el("label", { for: "fb" }, "Dein Feedback geht an den Betreiber"), fbTa, el("div", { class: "row" }, fbBtn)),
    el("section", { class: "card" }, el("h2", null, "Deine Daten"),
      el("p", { class: "muted", style: "margin:0" }, "Lade alle über dich gespeicherten Daten herunter: Antworten, Karten, Meldungen, Feedback."),
      el("div", { class: "row" }, exp)),
    el("section", { class: "card" }, el("h2", null, "Konto löschen"),
      el("p", { class: "muted", style: "margin:0" }, "Löscht dein Konto, alle Antworten, Karten, Meldungen und dein Feedback sofort und endgültig. Das kann nicht rückgängig gemacht werden."),
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
  try { daten = await ladeAdmin(); } catch { view.replaceChildren(el("p", { class: "muted" }, "Laden fehlgeschlagen.")); return; }
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
      el("li", null, "Deine Übungsdaten: Antworten, Bewertungen des Prüfers, Lernkarten-Stufen."),
      el("li", null, "Meldungen und Feedback, die du selbst abschickst (ohne Namen)."),
      el("li", null, "Ein Tageszähler für die Prüfer-Aufrufe (wird nach spätestens 7 Tagen gelöscht)."),
      el("li", null, "Technisch beim Seitenaufruf: IP-Adresse und Zeitpunkt in den Server-Protokollen der Dienstleister (siehe unten).")),
    p("Es gibt keine Werbung, kein Tracking und keine Analyse-Tools. Im Browser wird nur die Anmeldung gespeichert (Local Storage), damit du angemeldet bleibst."),
    h("Wozu?"),
    p("Ausschließlich, um dir den Trainer bereitzustellen: Anmeldung, Speichern deines Lernstands, Bewertung deiner Antworten durch den KI-Prüfer, Bearbeitung deiner Meldungen."),
    h("Wer sieht deine Daten?"),
    el("ul", null,
      el("li", null, "Deine Antworten und Karten sieht nur du. Der Betreiber sieht sie nicht (technisch durch Zugriffsregeln in der Datenbank abgesichert)."),
      el("li", null, "Der Betreiber sieht Meldungen und Feedback (ohne Namen) sowie in der Nutzerverwaltung deine E-Mail-Adresse.")),
    h("Dienstleister"),
    el("ul", null,
      el("li", null, el("b", null, "Supabase"), " (Datenbank und Anmeldung), Rechenzentrum Frankfurt am Main."),
      el("li", null, el("b", null, "GitHub Pages"), " (Auslieferung der Webseite). Dabei werden IP-Adressen verarbeitet, auch außerhalb der EU."),
      el("li", null, el("b", null, "Brevo"), " (Versand der Einladungs- und Login-Mails). Dafür wird deine E-Mail-Adresse übermittelt."),
      el("li", null, el("b", null, "Anthropic"), " (KI-Prüfer, USA). Übermittelt werden nur der Fragetext und deine Antwort, ", el("b", null, "nicht"), " deine E-Mail-Adresse oder Nutzerkennung. Anthropic löscht diese Daten nach eigenen Angaben standardmäßig innerhalb von 30 Tagen.")),
    h("Wie lange?"),
    p("Bis du dein Konto löschst. Das geht jederzeit selbst unter „Konto“ und entfernt sofort alle deine Daten. Der Tageszähler wird nach spätestens 7 Tagen gelöscht."),
    h("Deine Rechte"),
    p("Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Auskunft und Löschung kannst du direkt unter „Konto“ selbst ausführen. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren."),
    el("p", { class: "muted small" }, "Stand: " + STAND_DATENSCHUTZ),
    el("p", null, el("a", { href: "#" }, "Zurück"))));
}
