import { createClient } from "@supabase/supabase-js";

// Nur öffentliche Werte (URL + publishable Key). Geheime Schlüssel gehören NIE ins Frontend.
// Nur die Projekt-Adresse (https://<ref>.supabase.co) – ein versehentlich mitkopiertes /rest/v1 wird entfernt.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ?.trim()
  .replace(/\/rest\/v1\/?$/, "")
  .replace(/\/+$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseKonfiguriert = Boolean(url && key);

export const supabase = supabaseKonfiguriert
  ? createClient(url!, key!, { auth: { persistSession: true, detectSessionInUrl: true } })
  : null;
