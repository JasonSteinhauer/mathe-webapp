-- Mathe-Trainer: Tabellen, Zugriffsregeln (RLS) und Hilfsfunktionen
-- Ausführen im Supabase SQL Editor (einmalig). Idempotent, soweit sinnvoll.
-- Grundsatz: Jede Person sieht nur ihre eigenen Daten. Der Admin sieht Meldungen
-- und Feedback, aber KEINE fremden Antworten oder Karten.

-- ---------------------------------------------------------------
-- 1) Inhalte (ohne Personenbezug)
-- ---------------------------------------------------------------
create table if not exists public.fragen (
  id         text primary key,                 -- z. B. "v3-05"
  kapitel    smallint[] not null,              -- z. B. {3,5}
  format     text not null check (format in ('erklaere','rechnung','janein','anwendung','alltag','verknuepfung')),
  text       text not null check (length(text) between 5 and 1000),
  fallen     text[] not null default '{}',     -- Fehlertyp-IDs (nur Hinweis für den Prüfer)
  aktiv      boolean not null default true,
  erstellt_am timestamptz not null default now()
);

create table if not exists public.begriffe (
  id         text primary key,                 -- z. B. "g-aquivalenzrelation"
  begriff    text not null check (length(begriff) between 1 and 200),
  kapitel    smallint not null,
  aktiv      boolean not null default true
);

-- ---------------------------------------------------------------
-- 2) Profile + Admin-Rolle
-- ---------------------------------------------------------------
create table if not exists public.profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  ist_admin   boolean not null default false,
  erstellt_am timestamptz not null default now()
);

-- Profil automatisch anlegen, sobald ein Auth-Konto entsteht (Einladung)
create or replace function public.neues_profil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists auth_neues_profil on auth.users;
create trigger auth_neues_profil after insert on auth.users
  for each row execute function public.neues_profil();

-- Bestehende Konten nachtragen
insert into public.profile (id) select id from auth.users on conflict do nothing;

-- Admin-Prüfung (security definer, damit RLS auf profile keine Schleife erzeugt)
create or replace function public.ist_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select ist_admin from public.profile where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------
-- 3) Daten der Nutzer
-- ---------------------------------------------------------------
create table if not exists public.antworten (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  erstellt_am          timestamptz not null default now(),
  modus                text not null check (modus in ('wander','erklaer')),
  runde_id             text,
  frage_id             text not null,
  kapitel              smallint[] not null default '{}',
  format               text,
  frage                text not null check (length(frage) <= 1000),
  antwort              text not null default '' check (length(antwort) <= 2000),
  weiss_nicht          boolean not null default false,
  kategorie            text not null default 'offen' check (kategorie in ('richtig','teilweise','fehler','offen')),
  fehlertypen          text[] not null default '{}',
  tipp                 text not null default '' check (length(tipp) <= 1000),
  nachfrage            text not null default '' check (length(nachfrage) <= 600),
  antwort_nachfrage    text not null default '' check (length(antwort_nachfrage) <= 2000),
  kategorie_nachfrage  text not null default '' check (kategorie_nachfrage in ('','richtig','teilweise','fehler','offen')),
  fehlertypen_nachfrage text[] not null default '{}',
  tipp_nachfrage       text not null default '' check (length(tipp_nachfrage) <= 1000),
  zu_viel_verraten     boolean not null default false,
  quelle               text not null default 'offline' check (quelle in ('claude','offline'))
);
create index if not exists antworten_user_zeit on public.antworten (user_id, erstellt_am);

create table if not exists public.karten (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  karte_id  text not null,
  begriff   text not null,
  kapitel   smallint,
  stufe     smallint not null check (stufe between 1 and 5),
  faellig   timestamptz not null,
  letzte    timestamptz not null default now(),
  verlauf   jsonb not null default '[]'::jsonb,
  primary key (user_id, karte_id)
);

create table if not exists public.meldungen (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  frage_id    text not null,
  grund       text not null check (grund in ('unklar','fehlerhaft','loesung_verraten','pruefer_falsch','sonstiges')),
  text        text not null default '' check (length(text) <= 1000),
  status      text not null default 'offen' check (status in ('offen','erledigt','abgelehnt')),
  erstellt_am timestamptz not null default now()
);

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text        text not null check (length(text) between 1 and 2000),
  status      text not null default 'offen' check (status in ('offen','erledigt','abgelehnt')),
  erstellt_am timestamptz not null default now()
);

create table if not exists public.ki_nutzung (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag     date not null default (now() at time zone 'Europe/Berlin')::date,
  anzahl  integer not null default 0,
  primary key (user_id, tag)
);

-- ---------------------------------------------------------------
-- 4) Row Level Security
-- ---------------------------------------------------------------
alter table public.fragen     enable row level security;
alter table public.begriffe   enable row level security;
alter table public.profile    enable row level security;
alter table public.antworten  enable row level security;
alter table public.karten     enable row level security;
alter table public.meldungen  enable row level security;
alter table public.feedback   enable row level security;
alter table public.ki_nutzung enable row level security;

-- Inhalte: angemeldete Nutzer lesen aktive Einträge; Admin darf alles
drop policy if exists fragen_lesen on public.fragen;
create policy fragen_lesen on public.fragen for select to authenticated using (aktiv or public.ist_admin());
drop policy if exists fragen_admin on public.fragen;
create policy fragen_admin on public.fragen for all to authenticated using (public.ist_admin()) with check (public.ist_admin());

drop policy if exists begriffe_lesen on public.begriffe;
create policy begriffe_lesen on public.begriffe for select to authenticated using (aktiv or public.ist_admin());
drop policy if exists begriffe_admin on public.begriffe;
create policy begriffe_admin on public.begriffe for all to authenticated using (public.ist_admin()) with check (public.ist_admin());

-- Profil: nur eigene Zeile lesen; niemand ändert ist_admin über die API
drop policy if exists profil_lesen on public.profile;
create policy profil_lesen on public.profile for select to authenticated using (id = (select auth.uid()));

-- Antworten: nur eigene (kein Admin-Zugriff)
drop policy if exists antworten_eigene on public.antworten;
create policy antworten_eigene on public.antworten for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Karten: nur eigene
drop policy if exists karten_eigene on public.karten;
create policy karten_eigene on public.karten for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Meldungen: eigene anlegen/lesen; Admin liest alle und ändert den Status
drop policy if exists meldungen_anlegen on public.meldungen;
create policy meldungen_anlegen on public.meldungen for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists meldungen_lesen on public.meldungen;
create policy meldungen_lesen on public.meldungen for select to authenticated using (user_id = (select auth.uid()) or public.ist_admin());
drop policy if exists meldungen_admin on public.meldungen;
create policy meldungen_admin on public.meldungen for update to authenticated using (public.ist_admin()) with check (public.ist_admin());

-- Feedback: wie Meldungen
drop policy if exists feedback_anlegen on public.feedback;
create policy feedback_anlegen on public.feedback for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists feedback_lesen on public.feedback;
create policy feedback_lesen on public.feedback for select to authenticated using (user_id = (select auth.uid()) or public.ist_admin());
drop policy if exists feedback_admin on public.feedback;
create policy feedback_admin on public.feedback for update to authenticated using (public.ist_admin()) with check (public.ist_admin());

-- KI-Nutzung: nur eigene lesen; schreiben ausschließlich über ki_kontingent_verbrauchen()
drop policy if exists ki_nutzung_lesen on public.ki_nutzung;
create policy ki_nutzung_lesen on public.ki_nutzung for select to authenticated using (user_id = (select auth.uid()));

-- Spaltenrechte: Admin ändert bei Meldungen/Feedback nur den Status
revoke update on public.meldungen from authenticated;
grant update (status) on public.meldungen to authenticated;
revoke update on public.feedback from authenticated;
grant update (status) on public.feedback to authenticated;
-- Profile und KI-Nutzung sind über die API nicht schreibbar
revoke insert, update, delete on public.profile from anon, authenticated;
revoke insert, update, delete on public.ki_nutzung from anon, authenticated;
-- Gäste (nicht angemeldet) haben auf keine Tabelle Zugriff
revoke all on public.fragen, public.begriffe, public.profile, public.antworten,
  public.karten, public.meldungen, public.feedback, public.ki_nutzung from anon;

-- ---------------------------------------------------------------
-- 5) Tageslimit für den KI-Prüfer (atomar)
-- ---------------------------------------------------------------
-- Gibt die verbleibenden Aufrufe zurück (>= 0) oder -1, wenn das Limit erreicht ist.
-- Wird nur von der Edge Function (service_role) aufgerufen, die vorher das
-- Login-Token prüft und die Nutzer-ID übergibt. Nutzer können sie nicht aufrufen.
drop function if exists public.ki_kontingent_verbrauchen(integer);
create or replace function public.ki_kontingent_verbrauchen(p_user uuid, limit_pro_tag integer default 80)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  heute date := (now() at time zone 'Europe/Berlin')::date;
  neu integer;
begin
  if p_user is null then
    raise exception 'keine Nutzer-ID' using errcode = '22004';
  end if;
  insert into public.ki_nutzung as k (user_id, tag, anzahl)
    values (p_user, heute, 1)
  on conflict (user_id, tag) do update
    set anzahl = k.anzahl + 1
    where k.anzahl < limit_pro_tag
  returning anzahl into neu;
  if neu is null then
    return -1;   -- Limit erreicht, Zähler bleibt unverändert
  end if;
  return limit_pro_tag - neu;
end $$;

revoke all on function public.ki_kontingent_verbrauchen(uuid, integer) from public, anon, authenticated;
grant execute on function public.ki_kontingent_verbrauchen(uuid, integer) to service_role;

-- Restkontingent anzeigen (nur lesen)
create or replace function public.ki_kontingent_heute()
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select anzahl from public.ki_nutzung
    where user_id = auth.uid() and tag = (now() at time zone 'Europe/Berlin')::date), 0)
$$;
grant execute on function public.ki_kontingent_heute() to authenticated;

-- Alte Zählerzeilen sind nach einem Tag wertlos; Aufräumen (optional per Cron)
create or replace function public.ki_nutzung_aufraeumen()
returns void language sql security definer set search_path = '' as $$
  delete from public.ki_nutzung where tag < (now() at time zone 'Europe/Berlin')::date - 7
$$;
revoke all on function public.ki_nutzung_aufraeumen() from public, anon, authenticated;

-- Trigger-Funktion nicht über die API aufrufbar machen
revoke all on function public.neues_profil() from public, anon, authenticated;
