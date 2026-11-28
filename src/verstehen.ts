// „Verstehen“: Verständnis-Chat zu Glossar-Begriffen und zu eigenen Trainer-Aufgaben
// (ersetzt die bisherigen Selbsttest-Karten; der Leitner-Kasten für Begriffe bleibt im Hintergrund erhalten)
import { el, toast, kapLabel, kapName, fmtDate, shuffle, KAT_LABEL, DAY } from "./ui";
import { zustand, verstehe, ladeNachrichten, loescheChat, speichereKarte, LIMIT_PRO_TAG, type Antwort, type Begriff, type ChatNachricht, type Karte } from "./daten";
import { berechneStand } from "./lernstand";

type Offen = { chatId?: string; begriffId?: string; antwortId?: string; titel: string };
let offen: Offen | null = null;
let filter: "fehler" | "teilweise" | "richtig" = "fehler";

/** Von außen aufrufbar (z. B. aus der Wanderfrage oder dem Fortschritt) */
export function oeffneChatZuAntwort(a: Antwort): void {
  const vorhanden = zustand.chats.find((c) => c.antwort_id === a.id);
  offen = vorhanden ? { chatId: vorhanden.id, titel: vorhanden.titel } : { antwortId: a.id, titel: a.frage };
  location.hash = "#verstehen";
}
export function oeffneChatZuBegriff(b: Begriff): void {
  offen = { begriffId: b.id, titel: b.begriff };
  location.hash = "#verstehen";
}

/* ---------- Leitner für Begriffe (1/2/4/8/16 Tage) ---------- */
const INTERVALLE = [1, 2, 4, 8, 16];
function naechsteStufe(alt: number, bew: "sicher" | "unsicher" | "keine"): number {
  if (bew === "sicher") return Math.min(5, alt ? alt + 1 : 1);
  if (bew === "unsicher") return Math.max(1, alt);
  return 1;
}
async function bewerteBegriff(b: Begriff, bew: "sicher" | "unsicher" | "keine"): Promise<void> {
  const c = zustand.karten[b.id];
  const stufe = naechsteStufe(c ? c.stufe : 0, bew);
  const t = Date.now();
  const k: Karte = { karte_id: b.id, begriff: b.begriff, kapitel: b.kapitel, stufe, faellig: t + INTERVALLE[stufe - 1] * DAY, letzte: t,
    verlauf: (c?.verlauf ?? []).slice(-29).concat([{ ts: t, bewertung: bew }]) };
  if (await speichereKarte(k)) toast(bew === "sicher" ? `Gemerkt: kommt in ${INTERVALLE[stufe - 1]} Tag(en) wieder.` : "Gemerkt: kommt bald wieder.");
}

/* ---------- Übersicht ---------- */
export function renderVerstehen(view: HTMLElement): void {
  if (offen) { void renderChat(view, offen); return; }
  const now = Date.now();

  // Begriffe: fällige zuerst, dann neue, dann nach niedriger Stufe
  const begriffe = zustand.begriffe.slice();
  const faellig = begriffe.filter((b) => zustand.karten[b.id] && zustand.karten[b.id].faellig <= now).sort((a, b) => zustand.karten[a.id].stufe - zustand.karten[b.id].stufe);
  const neu = shuffle(begriffe.filter((b) => !zustand.karten[b.id]));
  const vorschlag = faellig.concat(neu).slice(0, 6);
  const dl = el("datalist", { id: "v-begriffe" }, ...begriffe.map((b) => el("option", { value: b.begriff }, kapName(b.kapitel))));
  const inp = el("input", { type: "text", id: "v-begriff", list: "v-begriffe", maxlength: 120, placeholder: "Begriff aus dem Glossar, z. B. Äquivalenzrelation", autocomplete: "off" });
  const los = el("button", { type: "button", class: "primary" }, "Begriff verstehen");
  los.addEventListener("click", () => {
    const b = begriffe.find((x) => x.begriff.toLowerCase() === inp.value.trim().toLowerCase());
    if (!b) { toast("Bitte einen Begriff aus der Liste wählen."); inp.focus(); return; }
    oeffneChatZuBegriff(b); renderVerstehen(view);
  });

  // Eigene Aufgaben: jeweils die letzte Antwort pro Frage
  const stand = berechneStand();
  const letzte: Record<string, Antwort> = {};
  for (const a of zustand.antworten) if (a.modus === "wander") { const p = letzte[a.frage_id]; if (!p || a.ts > p.ts) letzte[a.frage_id] = a; }
  const gruppe = (k: string) => Object.values(letzte).filter((a) => (k === "fehler" ? a.kategorie === "fehler" || a.kategorie === "offen" : a.kategorie === k));
  const liste = gruppe(filter).sort((a, b) => (stand[a.frage_id]?.stufe ?? 0) - (stand[b.frage_id]?.stufe ?? 0) || b.ts - a.ts);
  const chips = el("div", { class: "row" }, ...(["fehler", "teilweise", "richtig"] as const).map((k) =>
    el("button", { type: "button", class: k === filter ? "primary small" : "ghost small", onclick: () => { filter = k; renderVerstehen(view); } },
      (k === "fehler" ? "nicht gelöst" : k === "teilweise" ? "teilgelöst" : "gelöst") + ` (${gruppe(k).length})`)));

  view.replaceChildren(
    el("section", { class: "card" },
      el("h2", null, "Verstehen"),
      el("p", { class: "muted", style: "margin:0" }, "Ein Lern-Chat, der dir Themen Schritt für Schritt erklärt: erst mit Rückfragen und Hinweisen. Einen kompletten Lösungsweg zu einer Trainer-Frage gibt es nur, wenn du danach fragst, vorher mindestens zwei eigene Versuche gemacht hast und wirklich eine Lücke da ist."),
      el("p", { class: "muted small", style: "margin:0" }, `Jede Chat-Nachricht zählt zum Tageslimit (heute ${zustand.kiHeute} von ${LIMIT_PRO_TAG} genutzt). Keine Hausaufgaben oder persönlichen Daten einfügen.`)),
    el("section", { class: "card" },
      el("h2", null, "Meine Aufgaben"),
      chips,
      liste.length ? el("div", { class: "list" }, ...liste.slice(0, 30).map((a) => {
        const s = stand[a.frage_id];
        return el("div", null,
          el("div", { class: "row" }, el("span", { class: "pill " + a.kategorie }, KAT_LABEL[a.kategorie]), el("span", { class: "tag" }, kapLabel(a.kapitel)),
            s ? el("span", { class: "tag plain" }, "Stufe " + s.stufe + (s.verstanden ? " · verstanden" : "")) : null,
            zustand.chats.some((c) => c.antwort_id === a.id) ? el("span", { class: "trap" }, "Chat vorhanden") : null),
          el("span", { class: "small" }, a.frage),
          el("div", { class: "row" }, el("button", { type: "button", class: "small", onclick: () => { oeffneChatZuAntwort(a); renderVerstehen(view); } }, "Verstehen")));
      })) : el("p", { class: "muted", style: "margin:0" }, "Hier ist noch nichts. Beantworte Wanderfragen, dann kannst du sie hier aufarbeiten.")),
    el("section", { class: "card" },
      el("h2", null, "Begriffe"),
      el("p", { class: "muted small", style: "margin:0" }, `${faellig.length} Begriffe sind zur Wiederholung fällig, ${neu.length} noch nie besprochen.`),
      el("div", { class: "row" }, ...vorschlag.map((b) => el("button", { type: "button", class: "small", onclick: () => { oeffneChatZuBegriff(b); renderVerstehen(view); } }, b.begriff))),
      el("label", { for: "v-begriff" }, "Oder Begriff suchen"), inp, dl, el("div", { class: "row" }, los)),
    zustand.chats.length ? el("section", { class: "card" },
      el("h2", null, "Meine Chats"),
      el("div", { class: "list" }, ...zustand.chats.slice(0, 50).map((c) => {
        const del = el("button", { type: "button", class: "ghost small" }, "Löschen");
        del.addEventListener("click", async () => { if (await loescheChat(c.id)) renderVerstehen(view); else toast("Löschen fehlgeschlagen."); });
        return el("div", null,
          el("div", { class: "row" }, el("span", { class: "tag plain" }, c.typ === "begriff" ? "Begriff" : "Aufgabe"), el("span", { class: "muted small" }, fmtDate(c.aktualisiert_am)), c.loesung_gezeigt ? el("span", { class: "trap" }, "Lösung angesehen") : null),
          el("span", { class: "small" }, c.titel),
          el("div", { class: "row" }, el("button", { type: "button", class: "small", onclick: () => { offen = { chatId: c.id, titel: c.titel }; renderVerstehen(view); } }, "Weiter"), del));
      }))) : "");
}

/* ---------- Chat ---------- */
async function renderChat(view: HTMLElement, o: Offen): Promise<void> {
  const chatInfo = o.chatId ? zustand.chats.find((c) => c.id === o.chatId) : undefined;
  const begriffId = o.begriffId ?? chatInfo?.begriff_id ?? undefined;
  const begriff = begriffId ? zustand.begriffe.find((b) => b.id === begriffId) : undefined;
  const antwortId = o.antwortId ?? chatInfo?.antwort_id ?? undefined;
  const antwort = antwortId ? zustand.antworten.find((a) => a.id === antwortId) : undefined;

  const zurueck = el("button", { type: "button", class: "ghost small" }, "Zur Übersicht");
  zurueck.addEventListener("click", () => { offen = null; renderVerstehen(view); });
  const verlauf = el("div", { class: "chat" });
  const ta = el("textarea", { class: "short", id: "chat-in", maxlength: 2000, placeholder: "Was verstehst du nicht? Schreib deine Gedanken oder deinen Lösungsversuch." });
  const send = el("button", { type: "button", class: "primary" }, "Senden");
  const status = el("p", { class: "muted small", style: "margin:0" });

  const blase = (n: ChatNachricht) => el("div", { class: "msg " + n.rolle }, el("div", { class: "msg-text" }, n.text));
  const starter = (texte: string[]) => el("div", { class: "row" }, ...texte.map((t) => el("button", { type: "button", class: "ghost small", onclick: () => { ta.value = t; ta.focus(); } }, t)));

  const kontext = antwort ? el("details", { class: "symbols" },
    el("summary", null, "Deine ursprüngliche Antwort"),
    el("div", { class: "fb " + antwort.kategorie, style: "margin-top:8px" },
      el("div", { class: "row" }, el("span", { class: "pill " + antwort.kategorie }, KAT_LABEL[antwort.kategorie]), el("span", { class: "tag" }, kapLabel(antwort.kapitel))),
      el("p", { style: "margin:0;white-space:pre-wrap" }, antwort.antwort || "(wusste ich nicht)"),
      antwort.tipp ? el("p", { class: "small", style: "margin:0" }, "Prüfer-Tipp: " + antwort.tipp) : null)) : null;

  const bewertung = begriff ? el("div", { class: "card", style: "padding:14px;gap:8px" },
    el("h3", null, "Wie sicher bist du jetzt?"),
    el("div", { class: "row" },
      el("button", { type: "button", class: "small", onclick: () => void bewerteBegriff(begriff, "sicher") }, "Sicher"),
      el("button", { type: "button", class: "small", onclick: () => void bewerteBegriff(begriff, "unsicher") }, "Unsicher"),
      el("button", { type: "button", class: "small", onclick: () => void bewerteBegriff(begriff, "keine") }, "Noch nicht"))) : null;

  view.replaceChildren(
    el("div", { class: "row between", style: "margin-bottom:10px" }, el("span", { class: "muted small" }, begriff ? "Begriff · " + kapName(begriff.kapitel) : "Aufgabe"), zurueck),
    el("section", { class: "card" },
      begriff ? el("p", { class: "term" }, begriff.begriff) : el("p", { class: "question" }, o.titel),
      kontext, verlauf,
      el("label", { for: "chat-in" }, "Deine Nachricht"), ta,
      begriff ? starter(["Was bedeutet das genau?", "Gib mir ein Beispiel und ein Gegenbeispiel.", "Ich versuche es zu erklären: "])
        : starter(["Wo genau lag mein Fehler?", "Erklär mir das Thema dahinter.", "Mein neuer Versuch: "]),
      el("div", { class: "row" }, send), status,
      el("p", { class: "muted small", style: "margin:0" }, "Antworten kommen von einer KI und können Fehler enthalten.")),
    bewertung ?? "");

  if (o.chatId) {
    verlauf.append(el("p", { class: "muted small" }, "Lade Verlauf …"));
    const n = await ladeNachrichten(o.chatId);
    verlauf.replaceChildren(...n.map(blase));
  }

  async function senden() {
    const text = ta.value.trim(); if (!text) { ta.focus(); return; }
    send.disabled = true; ta.readOnly = true; status.textContent = "Denkt nach …";
    verlauf.append(blase({ rolle: "user", text }));
    const r = await verstehe({ chatId: o.chatId, begriffId: o.chatId ? undefined : o.begriffId, antwortId: o.chatId ? undefined : o.antwortId, nachricht: text });
    if (r.chatId) { o.chatId = r.chatId; o.begriffId = undefined; o.antwortId = undefined; }
    if (r.antwort) {
      verlauf.append(blase({ rolle: "assistant", text: r.antwort }));
      ta.value = "";
      status.textContent = r.loesungGezeigt ? "Lösungsweg angesehen: Diese Frage kommt in den Wanderfragen bald wieder, bis sie sitzt." : "";
    } else {
      status.textContent = r.fehler === "limit" ? `Du hast heute alle ${LIMIT_PRO_TAG} KI-Aufrufe genutzt. Morgen geht es weiter.`
        : r.fehler === "chat_voll" ? "Dieser Chat ist voll. Starte bitte einen neuen Chat."
        : "Gerade nicht erreichbar. Versuch es gleich noch einmal.";
      verlauf.lastElementChild?.remove();
    }
    send.disabled = false; ta.readOnly = false; ta.focus();
    verlauf.lastElementChild?.scrollIntoView({ block: "nearest" });
  }
  send.addEventListener("click", () => void senden());
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void senden(); } });
  setTimeout(() => ta.focus({ preventScroll: true }), 0);
}
