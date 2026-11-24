-- Tageszähler für den KI-Prüfer nach 7 Tagen löschen (täglich 03:15 UTC).
-- Ausgeführt am 24.11.2026 im Supabase SQL Editor.
create extension if not exists pg_cron;
select cron.schedule('ki_nutzung_aufraeumen', '15 3 * * *', 'select public.ki_nutzung_aufraeumen()');
