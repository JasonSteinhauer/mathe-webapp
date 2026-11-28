// Adaptiver Lernstand pro Person (A: pro Frage, B: pro Kapitel, C: Niveau für den Prüfer).
// Wird bei jedem Laden aus den eigenen Antworten und Chats neu berechnet (keine extra Tabelle,
// daher automatisch konsistent und mit „Konto löschen“ mit weg).
import { zustand, type Frage } from "./daten";
import { KAPITEL, DAY } from "./ui";

/** Abstand bis zur nächsten Wiederholung je Stufe (Tage). Stufe 0 = sofort wieder. */
const ABSTAND = [0, 1, 3, 7, 14, 30];
/** Verstandene Fragen kommen deutlich seltener (Entscheidung User 28.11.2026): 14 / 30 / 60 Tage */
const ABSTAND_VERSTANDEN = [14, 14, 14, 14, 30, 60];
/** Höchstens so viele KI-Varianten pro Ausgangsfrage (gleiche Grenze wie in der Edge Function) */
export const MAX_VARIANTEN = 3;

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
    stand[id] = { stufe, folge, faellig: (letzte ?? 0) + (verstanden ? ABSTAND_VERSTANDEN[stufe] : ABSTAND[stufe]) * DAY, letzte, versuche: liste.filter((e) => e.art !== "loesung").length, verstanden };
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
 * - verstandene Fragen nur, wenn sie fällig sind, und höchstens 1 pro Runde
 * - KI-Varianten (neue, schwierigere Fragen zu sicheren Themen) werden wie neue Fragen bevorzugt
 * - nicht fällige Fragen nur als Lückenfüller, wenn sonst nichts übrig ist
 */
export function waehleRunde(kap: Set<number>, n: number): Frage[] {
  const stand = berechneStand();
  const sicherheit = kapitelSicherheit(stand);
  const now = Date.now();
  const kandidaten = [...zustand.fragen, ...zustand.varianten].filter((q) => q.kapitel.some((v) => kap.has(v)));
  const bewertet = kandidaten.map((q) => {
    const s = stand[q.id];
    const kapSchwaeche = 1 - Math.min(...q.kapitel.filter((k) => kap.has(k)).map((k) => sicherheit[k]?.prozent ?? 0)) / 100;
    let score = Math.random() * 0.5 + kapSchwaeche;          // schwache Kapitel bevorzugt
    let verstanden = false, fueller = false;
    if (!s) score += q.basis_frage_id ? 1.3 : 1.0;           // neu; KI-Varianten leicht bevorzugt
    else if (s.verstanden) {
      verstanden = true;
      if (s.faellig <= now) score += 0.3; else { score -= 3; fueller = true; }
    }
    else if (s.faellig <= now) score += 1.5 - s.stufe * 0.2;  // fällig, schwache Stufen zuerst
    else { score -= 1.5; fueller = true; }                    // noch nicht fällig
    return { q, score, verstanden, fueller };
  }).sort((a, b) => b.score - a.score);

  const pick: Frage[] = [];
  const proKap: Record<number, number> = {};
  const maxKap = Math.max(3, Math.ceil(n / Math.max(1, kap.size)) + 2);
  let anzVerstanden = 0;
  // Eine fällige, schon verstandene Frage bekommt einen festen Platz (Auffrischen nach 14/30/60 Tagen)
  const faelligVerstanden = bewertet.find((b) => b.verstanden && !b.fueller);
  if (faelligVerstanden && n > 1) { pick.push(faelligVerstanden.q); proKap[faelligVerstanden.q.kapitel[0]] = 1; anzVerstanden = 1; }
  for (const { q, verstanden, fueller } of bewertet) {
    if (pick.includes(q)) continue;
    if (pick.length >= n) break;
    if (fueller) continue;
    if (verstanden && anzVerstanden >= 1) continue;
    const k = q.kapitel[0];
    if ((proKap[k] || 0) >= maxKap) continue;
    pick.push(q); proKap[k] = (proKap[k] || 0) + 1; if (verstanden) anzVerstanden++;
  }
  // Lückenfüller: zuerst noch nicht sichere, verstandene erst ganz zum Schluss
  for (const { q, verstanden } of bewertet) { if (pick.length >= n) break; if (!verstanden && !pick.includes(q)) pick.push(q); }
  // Nur wenn sonst fast nichts übrig ist (sehr kleiner Pool), auch sichere Fragen auffüllen
  if (pick.length < Math.min(n, 3)) for (const { q } of bewertet) { if (pick.length >= Math.min(n, 3)) break; if (!pick.includes(q)) pick.push(q); }
  // Reihenfolge leicht mischen, schwache Fragen nicht alle am Anfang
  return pick.sort(() => Math.random() - 0.5);
}

/**
 * Für welche sicher beherrschte Frage soll als Nächstes eine neue KI-Variante erzeugt werden?
 * Nur Pool-Fragen, die „verstanden“ sind, deren bisherige Varianten schon beantwortet wurden
 * und die noch keine MAX_VARIANTEN Varianten haben. Wenige pro Tag, damit das Tageslimit geschont wird.
 */
export function naechsteVarianteBasis(kap: Set<number>): string | null {
  const stand = berechneStand();
  const varianten = zustand.varianten;
  const offen = varianten.filter((v) => !stand[v.id]).length;
  if (offen >= 3) return null;                               // erst die vorhandenen neuen Fragen beantworten
  const heute = varianten.filter((v) => Date.now() - (v.erstellt_am ? Date.parse(v.erstellt_am) : Date.now()) < DAY).length;
  if (heute >= 5) return null;
  const moegliche = zustand.fragen.filter((q) => q.kapitel.some((k) => kap.has(k)) && stand[q.id]?.verstanden && stand[q.id].stufe >= 3)
    .filter((q) => {
      const eigene = varianten.filter((v) => v.basis_frage_id === q.id);
      return eigene.length < MAX_VARIANTEN && eigene.every((v) => stand[v.id]);
    });
  if (!moegliche.length) return null;
  return moegliche[Math.floor(Math.random() * moegliche.length)].id;
}
