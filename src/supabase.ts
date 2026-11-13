import { createClient } from "@supabase/supabase-js";

// Nur öffentliche Werte (URL + publishable Key). Geheime Schlüssel gehören NIE ins Frontend.
const env = (import.meta as ImportMeta & {
  env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string };
}).env;
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseKonfiguriert = Boolean(url && key);

export const supabase = supabaseKonfiguriert
  ? createClient(url!, key!, { auth: { persistSession: true, detectSessionInUrl: true } })
  : null;
