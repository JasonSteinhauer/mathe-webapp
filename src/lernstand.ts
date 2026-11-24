// Adaptiver Lernstand pro Person (A: pro Frage, B: pro Kapitel, C: Niveau für den Prüfer).
// Wird bei jedem Laden aus den eigenen Antworten und Chats neu berechnet (keine extra Tabelle,
// daher automatisch konsistent und mit „Konto löschen“ mit weg).
import { zustand, type Frage } from "./daten";
import { KAPITEL, DAY } from "./ui";

/** Abstand bis zur nächsten Wiederholung je Stufe (Tage). Stufe 0 = sofort wieder. */
const ABSTAND = [0, 1, 3, 7, 14, 30];

export type FragenStand = {
  stufe: number;          // 0–5
  folge: number;          // richtig in Folge
  faellig: number;        // Zeitpunkt der nächsten Wiederholung
  letzte: number | null;  // letzte Beschäftigung
  versuche: number;
  verstanden: boolean;    // mind. 2× in Folge richtig, mit mind. 1 Tag Abstand
};

type Ereignis = { ts: number; art: "richtig" | "teilweise" | "fehler" | "loesung" };

export function berechneStand(): Record<string, FragenStand> {
  const ereignisse: Record<string, Ereignis[]> = {};
  for (const a of zustand.antworten) {
    if (a.modus !== "wander") continue;
    const art = a.kategorie === "richtig" ? "richtig" : a.kategorie === "teilweise" ? "teilweise" : "fehler";
    // „offen“ (Prüfer nicht erreichbar) zählt nicht als Bewertung
    if (a.kategorie === "offen" && a.quelle !== "claude" && !a.weiss_nicht) continue;
    (ereignisse[a.frage_id] ??= []).push({ ts: a.ts, art });
  }
  for (const c of zustand.chats) {
    if (c.typ === "antwort" && c.frage_id && c.loesung_am) (ereignisse[c.frage_id] ??= []).push({ ts: c.loesung_am, art: "loesung" });
  }
  const stand: Record<string, FragenStand> = {};
  for (const [id, liste] of Object.entries(ereignisse)) {
    liste.sort((x, y) => x.ts - y.ts);
    let stufe = 0, folge = 0, letzteRichtig = 0, verstanden = false;
    let letzte: number | null = null;
    for (const e of liste) {
      if (e.art === "richtig") {
        // Mehrfach am selben Tag richtig zählt nur einmal als Aufstieg
        if (!letzteRichtig || e.ts - letzteRichtig >= DAY * 0.75 || stufe === 0) stufe = Math.min(5, stufe + 1);
        folge++;
        if (folge >= 2 && letzteRichtig && e.ts - letzteRichtig >= DAY * 0.75) verstanden = true;
        letzteRichtig = e.ts;
      } else if (e.art === "teilweise") {
        stufe = Math.max(0, stufe - 1); folge = 0; verstanden = false;
      } else {
        stufe = 0; folge = 0; verstanden = false; // Fehler oder Lösung angesehen
      }
      letzte = e.ts;
    }
    stand[id] = { stufe, folge, faellig: (letzte ?? 0) + ABSTAND[stufe] * DAY, letzte, versuche: liste.filter((e) => e.art !== "loesung").length, verstanden };
  }
  return stand;
}

/** Sicherheit pro Kapitel in Prozent (0–100): mittlere Stufe der Fragen des Kapitels, ungeübte zählen 0 */
export function kapitelSicherheit(stand = berechneStand()): Record<number, { prozent: number; geuebt: number; gesamt: number; verstanden: number }> {
  const out: Record<number, { prozent: number; geuebt: number; gesamt: number; verstanden: number }> = {};
  for (const k of KAPITEL) {
    const fr = zustand.fragen.filter((f) => f.kapitel.includes(k));
    let summe = 0, geuebt = 0, verstanden = 0;
    for (const f of fr) { const s = stand[f.id]; if (s) { summe += s.stufe; geuebt++; if (s.verstanden) verstanden++; } }
    out[k] = { prozent: fr.length ? Math.round((summe / (fr.length * 5)) * 100) : 0, geuebt, gesamt: fr.length, verstanden };
  }
  return out;
}

/** Niveau für den Prüfer: sicher beherrschte Fragen bekommen anspruchsvollere Nachfragen */
export function niveauFuer(frageId: string, stand = berechneStand()): "basis" | "vertieft" {
  const s = stand[frageId];
  return s && s.stufe >= 3 ? "vertieft" : "basis";
}

/**
 * Runde zusammenstellen:
 * - fällige und ungeübte Fragen aus schwachen Kapiteln zuerst
 * - Fragen, die man nicht versteht (Stufe 0/1), kommen immer wieder, bis sie sitzen
 * - sicher beherrschte Fragen (nicht fällig) nur selten: höchstens 2 pro Runde zum Auffrischen
 */
export function waehleRunde(kap: Set<number>, n: number): Frage[] {
  const stand = berechneStand();
  const sicherheit = kapitelSicherheit(stand);
  const now = Date.now();
  const kandidaten = zustand.fragen.filter((q) => q.kapitel.some((v) => kap.has(v)));
  const bewertet = kandidaten.map((q) => {
    const s = stand[q.id];
    const kapSchwaeche = 1 - Math.min(...q.kapitel.filter((k) => kap.has(k)).map((k) => sicherheit[k]?.prozent ?? 0)) / 100;
    let score = Math.random() * 0.5 + kapSchwaeche;          // schwache Kapitel bevorzugt
    let auffrischen = false;
    if (!s) score += 1.0;                                     // noch nie geübt
    else if (s.faellig <= now) score += 1.5 - s.stufe * 0.2;  // fällig, schwache Stufen zuerst
    else { score -= 1.5; auffrischen = true; }                // noch nicht fällig
    return { q, score, auffrischen };
  }).sort((a, b) => b.score - a.score);

  const pick: Frage[] = [];
  const proKap: Record<number, number> = {};
  const maxKap = Math.max(3, Math.ceil(n / Math.max(1, kap.size)) + 2);
  let auffrisch = 0;
  for (const { q, auffrischen } of bewertet) {
    if (pick.length >= n) break;
    if (auffrischen && auffrisch >= 2) continue;
    const k = q.kapitel[0];
    if ((proKap[k] || 0) >= maxKap) continue;
    pick.push(q); proKap[k] = (proKap[k] || 0) + 1; if (auffrischen) auffrisch++;
  }
  for (const { q } of bewertet) { if (pick.length >= n) break; if (!pick.includes(q)) pick.push(q); }
  // Reihenfolge leicht mischen, schwache Fragen nicht alle am Anfang
  return pick.sort(() => Math.random() - 0.5);
}
