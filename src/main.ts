import "./style.css";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseKonfiguriert } from "./supabase";
import { el } from "./ui";
import { ladeAlles, zustand } from "./daten";
import { renderWander, renderErklaer } from "./uebung";
import { renderVerstehen } from "./verstehen";
import { renderFortschritt } from "./fortschritt";
import { renderStart, renderKonto, renderAdmin, renderDatenschutz } from "./seiten";
import { renderDarstellung } from "./darstellung";
import { renderGruppe, kanalSchliessen } from "./gruppe";
import { berechneStand, kapitelSicherheit } from "./lernstand";
import { veroeffentlicheLernstand } from "./daten";
import { KAPITEL } from "./ui";
import { wendeAktivAn } from "./themes";

wendeAktivAn(); // gespeicherten Style sofort anwenden (vor dem ersten Zeichnen)

const app = document.getElementById("app")!;
const nav = document.getElementById("nav")!;

/* ---------------- Login: Code oder Link per E-Mail ---------------- */
function zeigeLogin(): void {
  nav.replaceChildren();
  nav.classList.add("hidden");
  if (location.hash === "#datenschutz") { renderDatenschutz(app); return; }
  if (location.hash === "#darstellung") { renderDarstellung(app); return; }
  const eingabe = el("input", { type: "email", id: "email", required: true, autocomplete: "email", placeholder: "name@beispiel.de" });
  const knopf = el("button", { type: "submit", class: "primary" }, "Login-Code senden");
  const status = el("p", { class: "muted small" });
  const form = el("form", { class: "card" },
    el("h2", null, "Anmelden"),
    el("p", { class: "muted", style: "margin:0" }, "Der Mathe-Trainer ist nur für eingeladene Personen. Du bekommst eine E-Mail mit einem Code und einem Link, ein Passwort gibt es nicht."),
    el("label", { for: "email" }, "E-Mail-Adresse"), eingabe, el("div", { class: "row" }, knopf), status);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;
    const email = eingabe.value.trim();
    knopf.disabled = true; status.textContent = "Sende …";
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
    if (error) console.warn("Login-Fehler", error.status, error.message);
    knopf.disabled = false;
    if (error && error.status === 429) status.textContent = "Zu viele Versuche. Warte ein paar Minuten.";
    else if (error && error.status !== 400 && error.status !== 422) status.textContent = "Der Login-Dienst ist gerade nicht erreichbar oder falsch eingerichtet (Fehler " + (error.status ?? "Netzwerk") + ").";
    else zeigeCodeEingabe(email); // 400/422 = nicht eingeladen → bewusst derselbe Ablauf
  });
  app.replaceChildren(form, el("section", { class: "card" },
    el("h2", null, "Was ist das?"),
    el("p", { style: "margin:0" }, "Ein Übungstrainer für Mathe 1 (Kapitel 1–7, EL 1 und EL 2): Fragen in eigenen Worten beantworten, Tipps von einem KI-Prüfer bekommen, Begriffe mit Lernkarten wiederholen. Ohne fertige Lösungen.")));
}

function zeigeCodeEingabe(email: string): void {
  const code = el("input", { type: "text", class: "code", id: "code", required: true, inputmode: "numeric", autocomplete: "one-time-code", pattern: "[0-9]{6,10}", maxlength: 10, placeholder: "123456" });
  const knopf = el("button", { type: "submit", class: "primary" }, "Anmelden");
  const zurueck = el("button", { type: "button" }, "Andere Adresse");
  const status = el("p", { class: "muted small" });
  const form = el("form", { class: "card" },
    el("h2", null, "Code eingeben"),
    el("p", { class: "muted", style: "margin:0" }, "Wenn " + email + " eingeladen ist, kommt gleich eine E-Mail. Gib den Code hier ein, oder klick in der Mail auf „Jetzt anmelden“."),
    el("label", { for: "code" }, "Code aus der E-Mail"), code, el("div", { class: "row" }, knopf, zurueck), status);
  zurueck.addEventListener("click", zeigeLogin);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;
    knopf.disabled = true; status.textContent = "Prüfe …";
    const { error } = await supabase.auth.verifyOtp({ email, token: code.value.replace(/\s/g, ""), type: "email" });
    knopf.disabled = false;
    if (error) {
      console.warn("Code-Fehler", error.status, error.message);
      status.textContent = error.status === 429 ? "Zu viele Versuche. Warte ein paar Minuten." : "Der Code stimmt nicht oder ist abgelaufen. Prüf ihn oder fordere einen neuen an.";
    }
  });
  app.replaceChildren(form);
  code.focus();
}

/* ---------------- Angemeldet: Navigation + Ansichten ---------------- */
let session: Session | null = null;
let ladeVersuch: Promise<void> | null = null;

const ANSICHTEN: Record<string, { titel: string; render: (v: HTMLElement) => void | Promise<void>; nav?: boolean; admin?: boolean }> = {
  start: { titel: "Start", render: renderStart, nav: true },
  wander: { titel: "Wanderfragen", render: renderWander, nav: true },
  erklaer: { titel: "Erklär's mir", render: renderErklaer, nav: true },
  verstehen: { titel: "Verstehen", render: renderVerstehen, nav: true },
  gruppe: { titel: "Gruppe", render: renderGruppe, nav: true },
  fortschritt: { titel: "Fortschritt", render: renderFortschritt, nav: true },
  konto: { titel: "Konto", render: (v) => renderKonto(v, session?.user.email ?? ""), nav: true },
  admin: { titel: "Admin", render: renderAdmin, nav: true, admin: true },
  datenschutz: { titel: "Datenschutz", render: renderDatenschutz },
  darstellung: { titel: "Darstellung", render: renderDarstellung },
};

function aktuelleAnsicht(): string {
  const h = location.hash.replace("#", "").split("?")[0];
  const a = ANSICHTEN[h];
  return a && (!a.admin || zustand.istAdmin) ? h : "start";
}

function zeichneNav(): void {
  const eintraege = Object.entries(ANSICHTEN).filter(([, a]) => a.nav && (!a.admin || zustand.istAdmin));
  nav.style.setProperty("--nav-n", String(eintraege.length));
  nav.replaceChildren(...eintraege.map(([k, a]) => el("a", { href: "#" + k, "data-view": k }, a.titel)));
  nav.classList.remove("hidden");
}

async function route(): Promise<void> {
  if (!session) { if (location.hash !== "#darstellung") wendeAktivAn(); zeigeLogin(); return; }
  if (!zustand.geladen) {
    app.replaceChildren(el("p", { class: "muted" }, "Lade deine Daten …"));
    try { await (ladeVersuch ??= ladeAlles()); }
    catch (e) {
      console.error(e); ladeVersuch = null;
      app.replaceChildren(el("div", { class: "notice warn" }, "Die Daten konnten nicht geladen werden. Prüf deine Verbindung und lade die Seite neu."));
      return;
    }
    zeichneNav();
  }
  const v = aktuelleAnsicht();
  if (v !== "darstellung") wendeAktivAn(); // ungespeicherte Vorschau aus dem Editor verwerfen
  if (v !== "gruppe") kanalSchliessen();
  // Lernstand pro Kapitel fürs Gruppen-Fenster veröffentlichen (nur bei Änderung)
  const sicher = kapitelSicherheit(berechneStand());
  void veroeffentlicheLernstand(Object.fromEntries(KAPITEL.map((k) => [String(k), sicher[k].prozent])));
  nav.querySelectorAll("a").forEach((a) => a.setAttribute("aria-current", a.dataset.view === v ? "page" : "false"));
  await ANSICHTEN[v].render(app);
}

function start(): void {
  if (!supabaseKonfiguriert || !supabase) {
    app.replaceChildren(el("p", null, "Supabase ist noch nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY fehlen)."));
    return;
  }
  window.addEventListener("hashchange", () => void route());
  supabase.auth.onAuthStateChange((ereignis, s) => {
    const vorher = session?.user.id;
    session = s;
    if (ereignis === "SIGNED_OUT" || (s && s.user.id !== vorher)) { zustand.geladen = false; ladeVersuch = null; }
    // Nur bei echten Wechseln neu zeichnen (nicht bei jedem Token-Refresh)
    if (ereignis === "INITIAL_SESSION" || ereignis === "SIGNED_IN" || ereignis === "SIGNED_OUT") {
      if (ereignis === "SIGNED_IN" && vorher === s?.user.id) return;
      setTimeout(() => void route(), 0);
    }
  });
}

start();
