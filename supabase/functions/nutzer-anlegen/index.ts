// Edge Function „nutzer-anlegen“: legt Konten OHNE Mail an (nur für Admins).
// - Aufrufer muss angemeldet sein und profile.ist_admin = true haben
// - nur Adressen @stud-provadis-hochschule.de, max. 50 pro Aufruf
// - Konto ist sofort bestätigt; die Person bekommt erst eine Mail, wenn sie sich
//   auf t-mathe-trainer.de selbst einen Login-Code anfordert
// - neue Konten sind KEINE Admins (Profil entsteht per Trigger mit ist_admin = false)
import { createClient } from "npm:@supabase/supabase-js@2";

function serviceSchluessel(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? "";
  } catch { return ""; }
}

const ERLAUBTE_URSPRUENGE = ["https://t-mathe-trainer.de", "https://www.t-mathe-trainer.de", "http://localhost:5173"];
const DOMAIN = "@stud-provadis-hochschule.de";
const MUSTER = /^[a-z0-9]+(?:[.-][a-z0-9]+)*@stud-provadis-hochschule\.de$/;

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
  const antwort = (b: unknown, s: number) => new Response(JSON.stringify(b), { status: s, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return antwort({ fehler: "methode" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceSchluessel(), { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return antwort({ fehler: "nicht_angemeldet" }, 401);
  const { data: prof } = await admin.from("profile").select("ist_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.ist_admin) return antwort({ fehler: "kein_admin" }, 403);

  let body: { emails?: unknown } = {};
  try { body = await req.json(); } catch { /* leer */ }
  const liste = Array.isArray(body.emails) ? body.emails.map((e) => String(e).trim().toLowerCase()) : [];
  if (!liste.length || liste.length > 50) return antwort({ fehler: "eingabe", hinweis: `1–50 Adressen mit ${DOMAIN}` }, 400);

  const ergebnis: { email: string; status: string }[] = [];
  for (const email of liste) {
    if (!MUSTER.test(email)) { ergebnis.push({ email, status: "ungueltig" }); continue; }
    const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (!error) ergebnis.push({ email, status: "angelegt" });
    else if (/already|registered|exists/i.test(error.message)) ergebnis.push({ email, status: "existiert_schon" });
    else { console.error("anlegen", error.message); ergebnis.push({ email, status: "fehler" }); }
  }
  return antwort({ ergebnis }, 200);
});
