// @ts-ignore CSS is loaded by the bundler; TypeScript has no declaration for this side-effect import.
import "./style.css";
import { supabase, supabaseKonfiguriert } from "./supabase";

// Stage 3: nur Gerüst – prüft, ob Build, Deploy und Supabase-Konfiguration ankommen.
const app = document.getElementById("app")!;

function zeige(text: string): void {
  app.replaceChildren(Object.assign(document.createElement("p"), { textContent: text }));
}

async function start(): Promise<void> {
  if (!supabaseKonfiguriert || !supabase) {
    zeige("Gerüst läuft. Supabase ist noch nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY fehlen).");
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) zeige("Gerüst läuft, aber Supabase meldet einen Fehler: " + error.message);
  else zeige(data.session ? "Gerüst läuft. Du bist angemeldet." : "Gerüst läuft. Supabase ist erreichbar, du bist nicht angemeldet.");
}

void start();
