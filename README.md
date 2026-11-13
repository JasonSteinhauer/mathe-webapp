# Mathe-Trainer (Webapp)

Vite + TypeScript, Supabase (Region Frankfurt), Deploy per GitHub Actions auf GitHub Pages.

## Lokal starten
1. Node.js 22 LTS installieren (nodejs.org)
2. `npm install`
3. `.env.example` nach `.env.local` kopieren und URL + publishable Key aus Supabase eintragen
4. `npm run dev` → http://localhost:5173

## Regeln
- Keine Lösungen in Code, Daten oder KI-Antworten.
- Nie ins Repo: `.env.local`, service_role/secret Key, Anthropic-Key, SMTP-Passwort.
- Öffentliche Werte für den Build liegen in GitHub → Settings → Secrets and variables → Actions → **Variables**.
