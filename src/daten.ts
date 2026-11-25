// Datenzugriff: Supabase-Tabellen (geschützt durch RLS) und Edge Functions
import { supabase } from "./supabase";

export type Frage = { id: string; kapitel: number[]; format: string; text: string; fallen: string[] };
export type Begriff = { id: string; begriff: string; kapitel: number };
export type Kategorie = "richtig" | "teilweise" | "fehler" | "offen";
export type Antwort = {
  id: string; ts: number; modus: "wander" | "erklaer" | "gruppe"; runde_id: string | null; frage_id: string; kapitel: number[];
  format: string | null; frage: string; antwort: string; weiss_nicht: boolean; kategorie: Kategorie; fehlertypen: string[];
  tipp: string; nachfrage: string; antwort_nachfrage: string; kategorie_nachfrage: string; fehlertypen_nachfrage: string[];
  tipp_nachfrage: string; zu_viel_verraten: boolean; quelle: "claude" | "offline";
};
export type Karte = { karte_id: string; begriff: string; kapitel: number | null; stufe: number; faellig: number; letzte: number; verlauf: { ts: number; bewertung: string }[] };
export type Feedback = { kategorie: Kategorie; fehlertypen: string[]; tipp: string; nachfrage: string };
export type PruefAntwort = { feedback?: Feedback; rest?: number; fehler?: string; limit?: number };
export type ChatInfo = { id: string; typ: "begriff" | "antwort"; begriff_id: string | null; antwort_id: string | null; frage_id: string | null; titel: string; loesung_gezeigt: boolean; loesung_am: number | null; aktualisiert_am: number };
export type ChatNachricht = { rolle: "user" | "assistant"; text: string };
export type ChatAntwort = { chatId?: string; titel?: string; antwort?: string; loesungGezeigt?: boolean; rest?: number; fehler?: string; limit?: number };

const sb = () => { if (!supabase) throw new Error("Supabase nicht konfiguriert"); return supabase; };

export const LIMIT_PRO_TAG = 40; // 24.11.: von 80 gesenkt (Qualität vor Menge, Prüfer denkt jetzt mit)

/* ---------- Zustand (im Speicher, pro Sitzung) ---------- */
export const zustand = {
  fragen: [] as Frage[],
  begriffe: [] as Begriff[],
  antworten: [] as Antwort[],
  karten: {} as Record<string, Karte>,
  chats: [] as ChatInfo[],
  istAdmin: false,
  anzeigename: "" as string,
  geladen: false,
  kiHeute: 0,
};

export async function ladeAlles(): Promise<void> {
  const c = sb();
  const [f, b, a, k, p, n, ch] = await Promise.all([
    c.from("fragen").select("id, kapitel, format, text, fallen").eq("aktiv", true).order("id"),
    c.from("begriffe").select("id, begriff, kapitel").eq("aktiv", true).order("kapitel").order("begriff"),
    c.from("antworten").select("*").order("erstellt_am", { ascending: true }).limit(5000),
    c.from("karten").select("*"),
    c.from("profile").select("ist_admin, anzeigename").maybeSingle(),
    c.rpc("ki_kontingent_heute"),
    c.from("chats").select("id, typ, begriff_id, antwort_id, frage_id, titel, loesung_gezeigt, loesung_am, aktualisiert_am").order("aktualisiert_am", { ascending: false }).limit(1000),
  ]);
  for (const r of [f, b, a, k]) if (r.error) throw r.error;
  zustand.fragen = f.data as Frage[];
  zustand.begriffe = b.data as Begriff[];
  zustand.antworten = (a.data ?? []).map(zuAntwort);
  zustand.karten = {};
  for (const row of k.data ?? []) zustand.karten[row.karte_id] = zuKarte(row);
  zustand.istAdmin = Boolean(p.data?.ist_admin);
  zustand.anzeigename = (p.data?.anzeigename as string | null) ?? "";
  zustand.kiHeute = typeof n.data === "number" ? n.data : 0;
  zustand.chats = (ch.data ?? []).map(zuChat);
  zustand.geladen = true;
}

function zuAntwort(r: Record<string, unknown>): Antwort {
  return { ...(r as unknown as Antwort), ts: Date.parse(String(r.erstellt_am)) };
}
function zuChat(r: Record<string, unknown>): ChatInfo {
  return { ...(r as unknown as ChatInfo), loesung_am: r.loesung_am ? Date.parse(String(r.loesung_am)) : null, aktualisiert_am: Date.parse(String(r.aktualisiert_am)) };
}
function zuKarte(r: Record<string, unknown>): Karte {
  return {
    karte_id: String(r.karte_id), begriff: String(r.begriff), kapitel: (r.kapitel as number) ?? null, stufe: Number(r.stufe),
    faellig: Date.parse(String(r.faellig)), letzte: Date.parse(String(r.letzte)), verlauf: (r.verlauf as Karte["verlauf"]) ?? [],
  };
}

/* ---------- Antworten ---------- */
export type NeueAntwort = Omit<Antwort, "id" | "ts">;
export async function speichereAntwort(rec: NeueAntwort): Promise<Antwort | null> {
  const { data, error } = await sb().from("antworten").insert(rec).select("*").single();
  if (error) { console.warn(error); return null; }
  const a = zuAntwort(data);
  zustand.antworten.push(a);
  return a;
}
export async function aktualisiereAntwort(id: string, patch: Partial<NeueAntwort>): Promise<boolean> {
  const { error } = await sb().from("antworten").update(patch).eq("id", id);
  if (error) { console.warn(error); return false; }
  const a = zustand.antworten.find((x) => x.id === id);
  if (a) Object.assign(a, patch);
  return true;
}

/* ---------- Karten ---------- */
export async function speichereKarte(k: Karte): Promise<boolean> {
  zustand.karten[k.karte_id] = k;
  const { error } = await sb().from("karten").upsert({
    karte_id: k.karte_id, begriff: k.begriff, kapitel: k.kapitel, stufe: k.stufe,
    faellig: new Date(k.faellig).toISOString(), letzte: new Date(k.letzte).toISOString(), verlauf: k.verlauf,
  });
  if (error) { console.warn(error); return false; }
  return true;
}

/* ---------- KI-Prüfer (Edge Function) ---------- */
export async function pruefe(body: {
  modus: "wander" | "erklaer"; frageId?: string; begriffId?: string; freiesThema?: string; antwort: string;
  phase: 1 | 2; vorher?: { kategorie: string; tipp: string; nachfrage: string; antwortNachfrage: string }; niveau?: "basis" | "vertieft";
}): Promise<PruefAntwort> {
  const { data, error } = await sb().functions.invoke("pruefe", { body });
  if (error) {
    // Bei HTTP-Fehlern liefert supabase-js den Body im context
    const ctx = (error as { context?: Response }).context;
    try { if (ctx && typeof ctx.json === "function") return await ctx.json(); } catch { /* ignorieren */ }
    return { fehler: "netz" };
  }
  const d = data as PruefAntwort;
  if (typeof d.rest === "number") zustand.kiHeute = LIMIT_PRO_TAG - d.rest;
  return d;
}

/* ---------- Verständnis-Chat (Edge Function „verstehen“) ---------- */
async function fehlerBody(error: unknown): Promise<Record<string, unknown>> {
  const ctx = (error as { context?: Response }).context;
  try { if (ctx && typeof ctx.json === "function") return await ctx.json(); } catch { /* ignorieren */ }
  return { fehler: "netz" };
}
export async function verstehe(body: { chatId?: string; begriffId?: string; antwortId?: string; nachricht: string }): Promise<ChatAntwort> {
  const { data, error } = await sb().functions.invoke("verstehen", { body });
  const d = (error ? await fehlerBody(error) : data) as ChatAntwort;
  if (typeof d.rest === "number") zustand.kiHeute = LIMIT_PRO_TAG - d.rest;
  if (d.chatId) {
    const jetzt = Date.now();
    const vorhanden = zustand.chats.find((c) => c.id === d.chatId);
    if (vorhanden) {
      vorhanden.aktualisiert_am = jetzt;
      if (d.loesungGezeigt && !vorhanden.loesung_gezeigt) { vorhanden.loesung_gezeigt = true; vorhanden.loesung_am = jetzt; }
    } else if (!error) {
      const ant = body.antwortId ? zustand.antworten.find((x) => x.id === body.antwortId) : undefined;
      zustand.chats.unshift({ id: d.chatId, typ: body.antwortId ? "antwort" : "begriff", begriff_id: body.begriffId ?? null, antwort_id: body.antwortId ?? null,
        frage_id: ant?.frage_id ?? null, titel: d.titel ?? "", loesung_gezeigt: Boolean(d.loesungGezeigt), loesung_am: d.loesungGezeigt ? jetzt : null, aktualisiert_am: jetzt });
    }
  }
  return d;
}
export async function ladeNachrichten(chatId: string): Promise<ChatNachricht[]> {
  const { data, error } = await sb().from("chat_nachrichten").select("rolle, text").eq("chat_id", chatId).order("id", { ascending: true });
  if (error) { console.warn(error); return []; }
  return data as ChatNachricht[];
}
export async function loescheChat(chatId: string): Promise<boolean> {
  const { error } = await sb().from("chats").delete().eq("id", chatId);
  if (error) { console.warn(error); return false; }
  zustand.chats = zustand.chats.filter((c) => c.id !== chatId);
  return true;
}

/* ---------- Meldungen, Feedback ---------- */
export async function meldeFrage(frageId: string, grund: string, text: string): Promise<boolean> {
  const { error } = await sb().from("meldungen").insert({ frage_id: frageId, grund, text: text.slice(0, 1000) });
  if (error) console.warn(error);
  return !error;
}
export async function sendeFeedback(text: string): Promise<boolean> {
  const { error } = await sb().from("feedback").insert({ text: text.slice(0, 2000) });
  if (error) console.warn(error);
  return !error;
}

/* ---------- Admin ---------- */
export type Meldung = { id: string; frage_id: string; grund: string; text: string; status: string; erstellt_am: string };
export type FeedbackEintrag = { id: string; text: string; status: string; erstellt_am: string };
export async function ladeAdmin(): Promise<{ meldungen: Meldung[]; feedback: FeedbackEintrag[] }> {
  const [m, f] = await Promise.all([
    sb().from("meldungen").select("id, frage_id, grund, text, status, erstellt_am").order("erstellt_am", { ascending: false }).limit(500),
    sb().from("feedback").select("id, text, status, erstellt_am").order("erstellt_am", { ascending: false }).limit(500),
  ]);
  if (m.error) throw m.error;
  if (f.error) throw f.error;
  return { meldungen: m.data as Meldung[], feedback: f.data as FeedbackEintrag[] };
}
export async function setzeStatus(tabelle: "meldungen" | "feedback", id: string, status: string): Promise<boolean> {
  const { error } = await sb().from(tabelle).update({ status }).eq("id", id);
  if (error) console.warn(error);
  return !error;
}

/* ---------- Eigene Daten ---------- */
export async function exportiereEigeneDaten(): Promise<Blob> {
  const c = sb();
  const [a, k, m, f, ch, cn, u] = await Promise.all([
    c.from("antworten").select("*"), c.from("karten").select("*"),
    c.from("meldungen").select("*"), c.from("feedback").select("*"),
    c.from("chats").select("*"), c.from("chat_nachrichten").select("chat_id, rolle, text, erstellt_am").order("id"), c.auth.getUser(),
  ]);
  const daten = {
    exportiert_am: new Date().toISOString(),
    email: u.data.user?.email ?? null,
    antworten: a.data ?? [], karten: k.data ?? [], meldungen: m.data ?? [], feedback: f.data ?? [],
    chats: ch.data ?? [], chat_nachrichten: cn.data ?? [],
  };
  return new Blob([JSON.stringify(daten, null, 2)], { type: "application/json" });
}
export async function loescheKonto(): Promise<boolean> {
  const { error } = await sb().functions.invoke("konto-loeschen", { body: { bestaetigung: "LÖSCHEN" } });
  if (error) { console.warn(error); return false; }
  await sb().auth.signOut();
  return true;
}

/* ---------- Profil: Anzeigename + veröffentlichter Lernstand ---------- */
export async function setzeAnzeigename(name: string): Promise<boolean> {
  const n = name.trim().slice(0, 30);
  if (!n) return false;
  const { data: u } = await sb().auth.getUser();
  const { error } = await sb().from("profile").update({ anzeigename: n }).eq("id", u.user?.id ?? "");
  if (error) { console.warn(error); return false; }
  zustand.anzeigename = n;
  return true;
}
let letzterLernstand = "";
/** Lernstand pro Kapitel (Prozent) ins Profil schreiben – sichtbar nur für Mitglieder gemeinsamer Gruppenräume */
export async function veroeffentlicheLernstand(stand: Record<string, number>): Promise<void> {
  const j = JSON.stringify(stand);
  if (j === letzterLernstand) return;
  letzterLernstand = j;
  const { data: u } = await sb().auth.getUser();
  const { error } = await sb().from("profile").update({ lernstand: stand, lernstand_am: new Date().toISOString() }).eq("id", u.user?.id ?? "");
  if (error) { console.warn(error); letzterLernstand = ""; }
}

/* ---------- Gruppenräume ---------- */
export type Raum = { id: string; code: string; runde: number; frage_id: string; phase: "sammeln" | "bewerten" | "nachfragen" | "fertig";
  antwort: string; antwort_von: string | null; antwort_am: string | null; bewertung: { kategorie: Kategorie; fehlertypen: string[]; tipp: string } | null; aktiv_am: string };
export type RaumMitglied = { user_id: string; anzeigename: string; lernstand: Record<string, number>; hat_nachfrage: boolean; beantwortet: boolean };
export type GruppenAntwort = { ok?: boolean; feedback?: Feedback; rest?: number; fehler?: string; limit?: number };

function rpcFehler(e: { message?: string } | null): string { return (e?.message ?? "netz").replace(/^.*?(\w+)$/, "$1"); }

export async function raumErstellen(frageId: string): Promise<{ id?: string; fehler?: string }> {
  const { data, error } = await sb().rpc("raum_erstellen", { p_frage: frageId });
  if (error) return { fehler: rpcFehler(error) };
  return { id: (data as { id: string }[])[0]?.id };
}
export async function raumBeitreten(code: string): Promise<{ id?: string; fehler?: string }> {
  const { data, error } = await sb().rpc("raum_beitreten", { p_code: code });
  if (error) return { fehler: rpcFehler(error) };
  return { id: data as string };
}
export async function raumVerlassen(id: string): Promise<void> { await sb().rpc("raum_verlassen", { p_raum: id }); }
export async function raumNaechste(id: string, frageId: string): Promise<string | null> {
  const { error } = await sb().rpc("raum_naechste", { p_raum: id, p_frage: frageId });
  return error ? rpcFehler(error) : null;
}
export async function ladeRaum(id: string): Promise<Raum | null> {
  const { data, error } = await sb().from("raeume").select("id, code, runde, frage_id, phase, antwort, antwort_von, antwort_am, bewertung, aktiv_am").eq("id", id).maybeSingle();
  if (error) console.warn(error);
  return (data as Raum) ?? null;
}
export async function ladeRaumStatus(id: string): Promise<RaumMitglied[]> {
  const { data, error } = await sb().rpc("raum_status", { p_raum: id });
  if (error) { console.warn(error); return []; }
  return Array.isArray(data) ? (data as RaumMitglied[]) : [];
}
export async function eigeneNachfrage(id: string, runde: number): Promise<{ nachfrage: string; beantwortet: boolean } | null> {
  const { data } = await sb().from("raum_nachfragen").select("nachfrage, beantwortet").eq("raum_id", id).eq("runde", runde).maybeSingle();
  return (data as { nachfrage: string; beantwortet: boolean }) ?? null;
}
export async function meineRaeume(): Promise<{ id: string; code: string; aktiv_am: string; frage_id: string }[]> {
  const { data } = await sb().from("raeume").select("id, code, aktiv_am, frage_id").order("aktiv_am", { ascending: false }).limit(10);
  return (data ?? []) as { id: string; code: string; aktiv_am: string; frage_id: string }[];
}
export async function schreibeGruppenAntwort(id: string, text: string): Promise<boolean> {
  const { data: u } = await sb().auth.getUser();
  const { error } = await sb().from("raeume").update({ antwort: text.slice(0, 4000), antwort_von: u.user?.id, antwort_am: new Date().toISOString() }).eq("id", id);
  if (error) console.warn(error);
  return !error;
}
export async function gruppeKI(body: { aktion: "bewerten" | "nachfrage"; raumId: string; antwort?: string }): Promise<GruppenAntwort> {
  const { data, error } = await sb().functions.invoke("gruppe", { body });
  const d = (error ? await fehlerBody(error) : data) as GruppenAntwort;
  if (typeof d.rest === "number") zustand.kiHeute = LIMIT_PRO_TAG - d.rest;
  return d;
}

/* ---------- Admin: anonymes Scoreboard ---------- */
export type StatZeile = { nutzer: string; antworten: number; richtig_prozent: number | null; antworten_7_tage: number; gruppen_antworten: number;
  chats: number; ki_7_tage: number; letzte_aktivitaet: string | null; lernstand: Record<string, number> };
export async function ladeStatistik(): Promise<StatZeile[]> {
  const { data, error } = await sb().rpc("admin_statistik");
  if (error) throw error;
  return Array.isArray(data) ? (data as StatZeile[]) : [];
}

/** Nach einer Gruppen-Nachfrage die private Antwortzeile (von der Edge Function angelegt) in den Zustand holen */
export async function holeGruppenAntwort(rundeId: string): Promise<void> {
  const { data } = await sb().from("antworten").select("*").eq("runde_id", rundeId).limit(1);
  for (const r of data ?? []) if (!zustand.antworten.some((a) => a.id === r.id)) zustand.antworten.push(zuAntwort(r));
}
