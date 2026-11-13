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
  const knopf = el("button", { type: "submit", className: "primary", textContent: "Login-Link senden" });
  const status = el("p", { className: "muted small" });
  const form = el("form", { className: "card" },
    el("h2", { textContent: "Anmelden" }),
    el("p", { className: "muted", textContent: "Der Trainer ist nur für eingeladene Personen. Du bekommst einen Link per E-Mail, ein Passwort gibt es nicht." }),
    el("label", { htmlFor: "email", textContent: "E-Mail-Adresse" }),
    eingabe, knopf, status
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!supabase) return;
    knopf.disabled = true;
    status.textContent = "Sende …";
    const { error } = await supabase.auth.signInWithOtp({
      email: eingabe.value.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin }
    });
    // Gleiche Meldung für eingeladene und nicht eingeladene Adressen,
    // damit niemand ausprobieren kann, wer eingeladen ist.
    if (error && error.status && error.status >= 500) {
      status.textContent = "Der Login-Dienst ist gerade nicht erreichbar. Versuch es später noch einmal.";
    } else if (error && error.status === 429) {
      status.textContent = "Zu viele Versuche. Warte ein paar Minuten.";
    } else {
      status.textContent = "Wenn diese Adresse eingeladen ist, kommt gleich eine E-Mail mit dem Login-Link.";
    }
    knopf.disabled = false;
  });
  app.replaceChildren(form);
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
