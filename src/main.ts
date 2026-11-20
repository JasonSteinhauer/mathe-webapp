import "./style.css";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseKonfiguriert } from "./supabase";

// Stage 3: Login per E-Mail-Link (nur Eingeladene). Trainer-Funktionen folgen in Stage 5.
const app = document.getElementById("app")!;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...kinder: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kinder);
  return n;
}

function zeigeHinweis(text: string): void {
  app.replaceChildren(el("p", { textContent: text }));
}

function zeigeLogin(): void {
  const eingabe = el("input", { type: "email", id: "email", required: true, autocomplete: "email", placeholder: "name@beispiel.de" });
  const knopf = el("button", { type: "submit", className: "primary", textContent: "Login-Code senden" });
  const status = el("p", { className: "muted small" });
  const form = el("form", { className: "card" },
    el("h2", { textContent: "Anmelden" }),
    el("p", { className: "muted", textContent: "Der Trainer ist nur für eingeladene Personen. Du bekommst eine E-Mail mit einem Code und einem Link, ein Passwort gibt es nicht." }),
    el("label", { htmlFor: "email", textContent: "E-Mail-Adresse" }),
    eingabe, knopf, status
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;
    const email = eingabe.value.trim();
    knopf.disabled = true;
    status.textContent = "Sende …";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin }
    });
    if (error) console.warn("Login-Fehler", error.status, error.message);
    knopf.disabled = false;
    if (error && error.status === 429) {
      status.textContent = "Zu viele Versuche. Warte ein paar Minuten.";
    } else if (error && error.status !== 400 && error.status !== 422) {
      status.textContent = "Der Login-Dienst ist gerade nicht erreichbar oder falsch eingerichtet (Fehler " + (error.status ?? "Netzwerk") + ").";
    } else {
      // 400/422 = Adresse nicht eingeladen → bewusst derselbe Ablauf wie bei Erfolg,
      // damit niemand ausprobieren kann, wer eingeladen ist.
      zeigeCodeEingabe(email);
    }
  });
  app.replaceChildren(form);
}

function zeigeCodeEingabe(email: string): void {
  const code = el("input", {
    type: "text", id: "code", required: true, inputMode: "numeric", autocomplete: "one-time-code",
    pattern: "[0-9]{6,10}", maxLength: 10, placeholder: "123456"
  });
  const knopf = el("button", { type: "submit", className: "primary", textContent: "Anmelden" });
  const zurueck = el("button", { type: "button", textContent: "Andere Adresse" });
  const status = el("p", { className: "muted small" });
  const form = el("form", { className: "card" },
    el("h2", { textContent: "Code eingeben" }),
    el("p", { className: "muted", textContent: "Wenn " + email + " eingeladen ist, kommt gleich eine E-Mail. Gib den Code hier ein – oder klick in der Mail auf „Jetzt anmelden“." }),
    el("label", { htmlFor: "code", textContent: "Code aus der E-Mail" }),
    code,
    el("div", { className: "row" }, knopf, zurueck),
    status
  );
  zurueck.addEventListener("click", zeigeLogin);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;
    knopf.disabled = true;
    status.textContent = "Prüfe …";
    const { error } = await supabase.auth.verifyOtp({ email, token: code.value.replace(/\s/g, ""), type: "email" });
    knopf.disabled = false;
    if (error) {
      console.warn("Code-Fehler", error.status, error.message);
      status.textContent = error.status === 429
        ? "Zu viele Versuche. Warte ein paar Minuten."
        : "Der Code stimmt nicht oder ist abgelaufen. Prüf ihn oder fordere einen neuen an.";
    }
    // Bei Erfolg schaltet onAuthStateChange automatisch auf „Angemeldet“ um.
  });
  app.replaceChildren(form);
  code.focus();
}

function zeigeAngemeldet(session: Session): void {
  const raus = el("button", { type: "button", textContent: "Abmelden" });
  raus.addEventListener("click", () => { void supabase?.auth.signOut(); });
  app.replaceChildren(el("section", { className: "card" },
    el("h2", { textContent: "Angemeldet" }),
    el("p", { textContent: "Du bist angemeldet als " + (session.user.email ?? "unbekannt") + ". Der Trainer kommt in Stage 5." }),
    raus
  ));
}

async function start(): Promise<void> {
  if (!supabaseKonfiguriert || !supabase) {
    zeigeHinweis("Gerüst läuft. Supabase ist noch nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY fehlen).");
    return;
  }
  supabase.auth.onAuthStateChange((_ereignis, session) => {
    if (session) zeigeAngemeldet(session); else zeigeLogin();
  });
  const { data } = await supabase.auth.getSession();
  if (data.session) zeigeAngemeldet(data.session); else zeigeLogin();
}

void start();
