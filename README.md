# Mathe-Trainer (Webapp)

Übungstrainer für Mathe 1 (Kapitel 1–7): Wanderfragen mit KI-Prüfer, Erklär's mir, Glossar-Karten (Leitner), Fortschritt.
Keine Lösungen in App, Code oder Datenbank.

**Stack:** Vite + TypeScript (ohne Framework) · Supabase (Region Frankfurt: Postgres, Auth, RLS, Edge Functions) · Claude Haiku 5.5 über die Anthropic API · GitHub Pages.

## Struktur
- `src/` – Frontend (`main.ts` Login + Routing, `uebung.ts`, `fortschritt.ts`, `seiten.ts`, `qa.ts`, `daten.ts`)
- `supabase/migrations/` – SQL: `001_schema.sql` (Tabellen, RLS, Limit-Funktion), `002_inhalte.sql` (Fragen + Begriffe)
- `supabase/functions/pruefe` – KI-Prüfer (Login-Prüfung, Tageslimit, Anthropic-Aufruf)
- `supabase/functions/konto-loeschen` – Konto + alle Daten löschen
- `supabase/templates/` – deutsche Mail-Vorlagen (in Supabase eingetragen)

## Lokal starten
1. Node.js 22 LTS
2. `npm install`
3. `.env.example` nach `.env.local` kopieren, URL + publishable Key eintragen
4. `npm run dev` → http://localhost:5173

## Regeln
- Nie ins Repo: `.env.local`, service_role/secret Key, Anthropic-Key, SMTP-Passwort.
- Build-Variablen (öffentlich) in GitHub → Settings → Secrets and variables → Actions → **Variables**:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VERANTWORTLICH_NAME`, `VITE_VERANTWORTLICH_KONTAKT`.
- Anthropic-Key nur als Supabase-Secret `ANTHROPIC_API_KEY` (Edge Functions → Secrets).
