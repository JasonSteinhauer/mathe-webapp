-- Verständnis-Chat: gespeicherte Chats pro Person (unbegrenzt, bis zur Konto-Löschung).
-- Nachrichten schreibt NUR die Edge Function „verstehen“ (service_role), damit der
-- Verlauf (und damit die Freigabe von Lösungen) nicht vom Browser manipuliert werden kann.
-- Nutzer dürfen ihre eigenen Chats lesen und löschen. Der Admin sieht keine Chats.

create table if not exists public.chats (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  typ              text not null check (typ in ('begriff','antwort')),
  begriff_id       text,
  antwort_id       uuid references public.antworten(id) on delete set null,
  frage_id         text,                       -- bei typ 'antwort': die Trainer-Frage
  titel            text not null check (length(titel) <= 300),
  loesung_gezeigt  boolean not null default false,
  loesung_am       timestamptz,
  erstellt_am      timestamptz not null default now(),
  aktualisiert_am  timestamptz not null default now()
);
create index if not exists chats_user_zeit on public.chats (user_id, aktualisiert_am desc);

create table if not exists public.chat_nachrichten (
  id          bigint generated always as identity primary key,
  chat_id     uuid not null references public.chats(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rolle       text not null check (rolle in ('user','assistant')),
  text        text not null check (length(text) <= 6000),
  erstellt_am timestamptz not null default now()
);
create index if not exists chat_nachrichten_chat on public.chat_nachrichten (chat_id, id);

alter table public.chats enable row level security;
alter table public.chat_nachrichten enable row level security;

drop policy if exists chats_lesen on public.chats;
create policy chats_lesen on public.chats for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists chats_loeschen on public.chats;
create policy chats_loeschen on public.chats for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists chat_nachrichten_lesen on public.chat_nachrichten;
create policy chat_nachrichten_lesen on public.chat_nachrichten for select to authenticated using (user_id = (select auth.uid()));

-- Schreiben nur über die Edge Function
revoke insert, update on public.chats from anon, authenticated;
revoke insert, update, delete on public.chat_nachrichten from anon, authenticated;
revoke all on public.chats, public.chat_nachrichten from anon;
