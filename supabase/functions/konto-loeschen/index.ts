// Edge Function „konto-loeschen“: löscht das eigene Konto und (per Kaskade)
// alle Antworten, Karten, Meldungen, Feedback und Zähler der Person.
import { createClient } from "npm:@supabase/supabase-js@2";

/** Service-Schlüssel: neues System (SUPABASE_SECRET_KEYS) oder Legacy (SUPABASE_SERVICE_ROLE_KEY) */
function serviceSchluessel(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? "";
  } catch { return ""; }
}

const ERLAUBTE_URSPRUENGE = ["https://t-mathe-trainer.de", "https://www.t-mathe-trainer.de", "http://localhost:5173"];

function cors(origin: string | null) {
  const o = origin && ERLAUBTE_URSPRUENGE.includes(origin) ? origin : ERLAUBTE_URSPRUENGE[0];
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const h = { ...cors(origin), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return new Response('{"fehler":"methode"}', { status: 405, headers: h });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceSchluessel(), { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return new Response('{"fehler":"nicht_angemeldet"}', { status: 401, headers: h });

  // Bestätigung im Body verlangt, damit ein versehentlicher Aufruf nichts löscht
  let body: { bestaetigung?: string } = {};
  try { body = await req.json(); } catch { /* leer */ }
  if (body.bestaetigung !== "LÖSCHEN") return new Response('{"fehler":"bestaetigung"}', { status: 400, headers: h });

  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) {
    console.error("loeschen", delErr.message);
    return new Response('{"fehler":"intern"}', { status: 500, headers: h });
  }
  return new Response('{"ok":true}', { status: 200, headers: h });
});
