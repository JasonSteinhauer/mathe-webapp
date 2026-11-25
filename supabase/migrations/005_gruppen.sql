-- 005: Gruppenmodus (Räume per Code, gemeinsame Antwort live, Einzelnachfragen)
--      + Anzeigename und veröffentlichter Lernstand im Profil
--      + anonymes Admin-Scoreboard
--
-- Sichtbarkeit (Entscheidung User, 25.11.2026):
--   * Gruppenmitglieder sehen: Anzeigenamen, gemeinsame Antwort, Gruppenbewertung,
--     ob die anderen ihre Nachfrage beantwortet haben, Lernstand pro Kapitel der anderen.
--   * NICHT sichtbar für andere: Einzelnachfragen, Einzelantworten, Einzelbewertungen.
--   * Admin-Scoreboard: nur anonym („Nutzer 7“), ohne E-Mail, ohne Anzeigename, ohne Texte.

-- ---------------------------------------------------------------
-- 1) Profil: Anzeigename + Lernstand (vom eigenen Browser berechnet)
-- ---------------------------------------------------------------
alter table public.profile add column if not exists anzeigename text
  check (anzeigename is null or length(btrim(anzeigename)) between 1 and 30);
alter table public.profile add column if not exists lernstand jsonb not null default '{}'::jsonb;
alter table public.profile add column if not exists lernstand_am timestamptz;

-- Eigene Zeile: nur diese drei Spalten dürfen geändert werden (ist_admin bleibt gesperrt)
drop policy if exists profil_eigene_aendern on public.profile;
create policy profil_eigene_aendern on public.profile for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profile from authenticated;
grant update (anzeigename, lernstand, lernstand_am) on public.profile to authenticated;

-- Gruppenergebnisse landen auch in den eigenen Antworten (Verlauf)
alter table public.antworten drop constraint if exists antworten_modus_check;
alter table public.antworten add constraint antworten_modus_check check (modus in ('wander','erklaer','gruppe'));

-- ---------------------------------------------------------------
-- 2) Räume
-- ---------------------------------------------------------------
create table if not exists public.raeume (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  erstellt_von  uuid not null references auth.users(id) on delete cascade,
  runde         integer not null default 1,
  frage_id      text not null references public.fragen(id),
  phase         text not null default 'sammeln' check (phase in ('sammeln','bewerten','nachfragen','fertig')),
  antwort       text not null default '' check (length(antwort) <= 4000),
  antwort_von   uuid references auth.users(id) on delete set null,
  antwort_am    timestamptz,
  bewertung     jsonb,                      -- {kategorie, fehlertypen, tipp}
  erstellt_am   timestamptz not null default now(),
  aktiv_am      timestamptz not null default now()
);

create table if not exists public.raum_mitglieder (
  raum_id        uuid not null references public.raeume(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  beigetreten_am timestamptz not null default now(),
  primary key (raum_id, user_id)
);
create index if not exists raum_mitglieder_user on public.raum_mitglieder (user_id);

create table if not exists public.raum_nachfragen (
  raum_id      uuid not null references public.raeume(id) on delete cascade,
  runde        integer not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  nachfrage    text not null check (length(nachfrage) <= 600),
  beantwortet  boolean not null default false,
  primary key (raum_id, runde, user_id)
);
-- Antworttext und Bewertung der Einzelnachfrage stehen NUR in den privaten antworten (modus 'gruppe').

-- Mitglied-Prüfung (security definer, damit RLS keine Schleife baut)
create or replace function public.ist_raummitglied(p_raum uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.raum_mitglieder where raum_id = p_raum and user_id = auth.uid())
$$;
revoke all on function public.ist_raummitglied(uuid) from public, anon;
grant execute on function public.ist_raummitglied(uuid) to authenticated;

alter table public.raeume enable row level security;
alter table public.raum_mitglieder enable row level security;
alter table public.raum_nachfragen enable row level security;

drop policy if exists raeume_lesen on public.raeume;
create policy raeume_lesen on public.raeume for select to authenticated using (public.ist_raummitglied(id));
-- Gemeinsame Antwort live bearbeiten: nur Mitglieder, nur in Phase „sammeln“, nur diese Spalten
drop policy if exists raeume_antwort on public.raeume;
create policy raeume_antwort on public.raeume for update to authenticated
  using (public.ist_raummitglied(id) and phase = 'sammeln')
  with check (public.ist_raummitglied(id) and phase = 'sammeln' and antwort_von = (select auth.uid()));
revoke insert, update, delete on public.raeume from anon, authenticated;
grant update (antwort, antwort_von, antwort_am) on public.raeume to authenticated;

drop policy if exists raum_mitglieder_lesen on public.raum_mitglieder;
create policy raum_mitglieder_lesen on public.raum_mitglieder for select to authenticated using (public.ist_raummitglied(raum_id));
revoke insert, update, delete on public.raum_mitglieder from anon, authenticated;

-- Nachfragen: jeder sieht nur seine eigene Nachfrage; Status der anderen über raum_status()
drop policy if exists raum_nachfragen_lesen on public.raum_nachfragen;
create policy raum_nachfragen_lesen on public.raum_nachfragen for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.raum_nachfragen from anon, authenticated;

revoke all on public.raeume, public.raum_mitglieder, public.raum_nachfragen from anon;

-- ---------------------------------------------------------------
-- 3) Funktionen für den Client
-- ---------------------------------------------------------------
-- Raum erstellen: Ersteller wird Mitglied; Code ohne verwechselbare Zeichen (kein I, O, 0, 1)
create or replace function public.raum_erstellen(p_frage text)
returns table (id uuid, code text) language plpgsql security definer set search_path = '' as $$
declare
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text; r uuid; i int;
begin
  if auth.uid() is null then raise exception 'nicht_angemeldet'; end if;
  if not exists (select 1 from public.fragen f where f.id = p_frage and f.aktiv) then raise exception 'frage_unbekannt'; end if;
  if (select count(*) from public.raeume x where x.erstellt_von = auth.uid() and x.erstellt_am > now() - interval '1 day') >= 20 then
    raise exception 'zu_viele_raeume';
  end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(zeichen, 1 + floor(random() * length(zeichen))::int, 1); end loop;
    exit when not exists (select 1 from public.raeume x where x.code = c);
  end loop;
  insert into public.raeume (code, erstellt_von, frage_id) values (c, auth.uid(), p_frage) returning raeume.id into r;
  insert into public.raum_mitglieder (raum_id, user_id) values (r, auth.uid());
  return query select r, c;
end $$;

-- Beitreten per Code (max. 6 Personen, nur Räume der letzten 24 h)
create or replace function public.raum_beitreten(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  if auth.uid() is null then raise exception 'nicht_angemeldet'; end if;
  select x.id into r from public.raeume x where x.code = upper(btrim(p_code)) and x.aktiv_am > now() - interval '24 hours';
  if r is null then raise exception 'raum_unbekannt'; end if;
  if not exists (select 1 from public.raum_mitglieder m where m.raum_id = r and m.user_id = auth.uid()) then
    if (select count(*) from public.raum_mitglieder m where m.raum_id = r) >= 6 then raise exception 'raum_voll'; end if;
    insert into public.raum_mitglieder (raum_id, user_id) values (r, auth.uid());
  end if;
  update public.raeume set aktiv_am = now() where id = r;
  return r;
end $$;

create or replace function public.raum_verlassen(p_raum uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.raum_mitglieder where raum_id = p_raum and user_id = auth.uid();
$$;

-- Nächste Aufgabe: nur wenn die Runde fertig ist (oder noch nichts abgegeben wurde)
create or replace function public.raum_naechste(p_raum uuid, p_frage text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_raummitglied(p_raum) then raise exception 'kein_mitglied'; end if;
  if not exists (select 1 from public.fragen f where f.id = p_frage and f.aktiv) then raise exception 'frage_unbekannt'; end if;
  update public.raeume set runde = runde + 1, frage_id = p_frage, phase = 'sammeln', antwort = '', antwort_von = null,
    antwort_am = null, bewertung = null, aktiv_am = now()
  where id = p_raum and phase in ('sammeln','fertig');
  if not found then raise exception 'runde_laeuft'; end if;
end $$;

-- Mitglieder mit Anzeigename, Lernstand und Nachfrage-Status (ohne Inhalte)
create or replace function public.raum_status(p_raum uuid)
returns table (user_id uuid, anzeigename text, lernstand jsonb, hat_nachfrage boolean, beantwortet boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_raummitglied(p_raum) then raise exception 'kein_mitglied'; end if;
  return query
    select m.user_id, coalesce(p.anzeigename, 'Ohne Namen'), p.lernstand,
           n.user_id is not null, coalesce(n.beantwortet, false)
    from public.raum_mitglieder m
    join public.raeume r on r.id = m.raum_id
    left join public.profile p on p.id = m.user_id
    left join public.raum_nachfragen n on n.raum_id = m.raum_id and n.user_id = m.user_id and n.runde = r.runde
    where m.raum_id = p_raum
    order by m.beigetreten_am;
end $$;

revoke all on function public.raum_erstellen(text), public.raum_beitreten(text), public.raum_verlassen(uuid),
  public.raum_naechste(uuid, text), public.raum_status(uuid) from public, anon;
grant execute on function public.raum_erstellen(text), public.raum_beitreten(text), public.raum_verlassen(uuid),
  public.raum_naechste(uuid, text), public.raum_status(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 4) Anonymes Admin-Scoreboard (keine E-Mail, kein Name, keine Texte)
-- ---------------------------------------------------------------
create or replace function public.admin_statistik()
returns table (nutzer text, antworten bigint, richtig_prozent numeric, antworten_7_tage bigint,
               gruppen_antworten bigint, chats bigint, ki_7_tage bigint, letzte_aktivitaet date, lernstand jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_admin() then raise exception 'kein_admin'; end if;
  return query
    with n as (
      select p.id, 'Nutzer ' || row_number() over (order by p.erstellt_am, p.id) as nutzer, p.lernstand
      from public.profile p
    )
    select n.nutzer,
      (select count(*) from public.antworten a where a.user_id = n.id),
      (select round(100.0 * count(*) filter (where a.kategorie = 'richtig') / nullif(count(*), 0), 0)
         from public.antworten a where a.user_id = n.id and a.kategorie <> 'offen'),
      (select count(*) from public.antworten a where a.user_id = n.id and a.erstellt_am > now() - interval '7 days'),
      (select count(*) from public.antworten a where a.user_id = n.id and a.modus = 'gruppe'),
      (select count(*) from public.chats c where c.user_id = n.id),
      (select coalesce(sum(k.anzahl), 0) from public.ki_nutzung k where k.user_id = n.id and k.tag > current_date - 7),
      (select max(a.erstellt_am)::date from public.antworten a where a.user_id = n.id),
      n.lernstand
    from n
    order by 2 desc, 1;
end $$;
revoke all on function public.admin_statistik() from public, anon;
grant execute on function public.admin_statistik() to authenticated;

-- ---------------------------------------------------------------
-- 5) Live-Updates (Supabase Realtime, beachtet RLS) + Aufräumen
-- ---------------------------------------------------------------
do $$ begin
  begin alter publication supabase_realtime add table public.raeume; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.raum_mitglieder; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.raum_nachfragen; exception when duplicate_object then null; end;
end $$;

-- Räume (inkl. gemeinsamer Antwort) werden 7 Tage nach der letzten Aktivität gelöscht.
-- Die eigenen Ergebnisse bleiben in den privaten antworten (modus 'gruppe').
create or replace function public.raeume_aufraeumen()
returns void language sql security definer set search_path = '' as $$
  delete from public.raeume where aktiv_am < now() - interval '7 days';
$$;
revoke all on function public.raeume_aufraeumen() from public, anon, authenticated;
select cron.schedule('raeume_aufraeumen', '20 3 * * *', 'select public.raeume_aufraeumen()');
