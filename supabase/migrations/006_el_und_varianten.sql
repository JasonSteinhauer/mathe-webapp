-- 006: Neue Kapitel EL 1 (kapitel = 8) und EL 2 (kapitel = 9) + KI-Fragevarianten pro Person
-- Fragen und Begriffe sind EIGENE Formulierungen zum Stoff (keine Folien-/HA-Aufgaben), KEINE Lösungen.
-- Anzeige im Frontend: 8 → „EL 1“, 9 → „EL 2“.

insert into public.fragen (id, kapitel, format, text, fallen) values
('e1-01', '{"8"}'::smallint[], 'erklaere', 'Was beschreibt der Betrag |z| einer komplexen Zahl geometrisch? Warum ist z · z̄ immer eine reelle Zahl ≥ 0?', '{"begriff_unpraezise","begruendung_fehlt"}'::text[]),
('e1-02', '{"8"}'::smallint[], 'rechnung', 'Berechne |3 − 4i| und |−2i|. Welches rechtwinklige Dreieck benutzt du dabei jeweils?', '{"rechenfehler"}'::text[]),
('e1-03', '{"8"}'::smallint[], 'janein', 'Stimmt |z| = |z̄| für jede komplexe Zahl z? Begründe allgemein, nicht nur an einem Beispiel.', '{"beispiel_beweis","begruendung_fehlt"}'::text[]),
('e1-04', '{"8"}'::smallint[], 'anwendung', 'Beschreibe die Menge {z ∈ ℂ; |z − 1| ≤ 2} in der Gaußschen Zahlenebene. Woran erkennst du Mittelpunkt und Radius?', '{"definitionsbereich"}'::text[]),
('e1-05', '{"8"}'::smallint[], 'erklaere', 'Erkläre geometrisch, wie man z + w und z − w in der Gaußschen Zahlenebene findet.', '{"begriff_unpraezise"}'::text[]),
('e1-06', '{"8"}'::smallint[], 'janein', 'Darf man „2i > i“ schreiben? Begründe, warum (nicht) – auch wenn es auf den ersten Blick logisch wirkt.', '{"begruendung_fehlt"}'::text[]),
('e1-07', '{"8"}'::smallint[], 'erklaere', 'Formuliere die Dreiecksungleichung für komplexe Zahlen und erkläre mit einer Skizze, warum sie „Dreiecks“-Ungleichung heißt.', '{"begriff_unpraezise"}'::text[]),
('e1-08', '{"8"}'::smallint[], 'rechnung', 'Rechne 45 mit dem Algorithmus (mod und div) ins Dualsystem um. Schreib jeden Schritt auf.', '{"rechenfehler"}'::text[]),
('e1-09', '{"8"}'::smallint[], 'rechnung', 'Welche Dezimalzahlen sind (2F)₁₆ und (10110)₂? Zeige die Stellenwerte.', '{"rechenfehler"}'::text[]),
('e1-10', '{"8"}'::smallint[], 'erklaere', 'Warum ist die Darstellung einer Zahl zur Basis b eindeutig? Welche Rolle spielt die Bedingung, dass jede Ziffer zwischen 0 und b − 1 liegt?', '{"begruendung_fehlt"}'::text[]),
('e1-11', '{"8"}'::smallint[], 'anwendung', 'Warum zeigen Programme Speicherinhalte oft hexadezimal statt dual an? Welcher Zusammenhang besteht zwischen einer Hex-Ziffer und Bits?', '{"begriff_unpraezise"}'::text[]),
('e1-12', '{"8"}'::smallint[], 'janein', 'Warum muss die Basis b eines Stellenwertsystems mindestens 2 sein? Was ginge bei b = 1 schief?', '{"begruendung_fehlt"}'::text[]),
('e1-13', '{"7","8"}'::smallint[], 'verknuepfung', 'Was bedeutet f(x ∗ y) = f(x) ∗′ f(y) für einen Gruppenhomomorphismus in Worten? Nenne ein eigenes Beispiel für einen Homomorphismus von (ℤ, +) nach (ℤ, +).', '{"begriff_unpraezise"}'::text[]),
('e1-14', '{"5","8"}'::smallint[], 'verknuepfung', 'Wie hängt der Umrechnungsalgorithmus ins Stellenwertsystem mit DIV und MOD zusammen? Warum bricht er garantiert ab?', '{"begruendung_fehlt","mod_kongruenz"}'::text[]),
('e2-01', '{"9"}'::smallint[], 'erklaere', 'Was bedeutet es, dass die Gleichungen eines linearen Gleichungssystems „simultan“ gelten sollen? Was ist bei zwei Unbekannten geometrisch eine Lösung?', '{"begriff_unpraezise"}'::text[]),
('e2-02', '{"9"}'::smallint[], 'rechnung', 'Löse x₁ + x₂ = 3, x₁ − x₂ = 1 mit dem Einsetzungsverfahren und mach die Probe.', '{"rechenfehler"}'::text[]),
('e2-03', '{"9"}'::smallint[], 'rechnung', 'Löse 2x₁ − x₂ = 0, x₁ + x₂ = 3 mit dem Gleichsetzungsverfahren.', '{"rechenfehler"}'::text[]),
('e2-04', '{"9"}'::smallint[], 'janein', 'Hat das System x₁ + 2x₂ = 4, 2x₁ + 4x₂ = 5 eine Lösung? Begründe rechnerisch und geometrisch.', '{"begruendung_fehlt"}'::text[]),
('e2-05', '{"9"}'::smallint[], 'erklaere', 'Welche drei Fälle von Lösbarkeit gibt es bei linearen Gleichungssystemen? Gib zu jedem ein eigenes kleines Beispiel mit zwei Unbekannten.', '{"begriff_unpraezise"}'::text[]),
('e2-06', '{"9"}'::smallint[], 'janein', 'Sind x und y Lösungen eines LGS mit rechter Seite 0, ist dann auch x + y eine Lösung? Gilt das auch, wenn die rechte Seite nicht 0 ist? Begründe.', '{"beispiel_beweis","begruendung_fehlt"}'::text[]),
('e2-07', '{"9"}'::smallint[], 'erklaere', 'Erkläre den Begriff Vektorraum in eigenen Worten: Welche zwei Verknüpfungen gibt es, und was sagen die Axiome anschaulich?', '{"begriff_unpraezise"}'::text[]),
('e2-08', '{"9"}'::smallint[], 'janein', 'Ist die Menge {(x₁, x₂) ∈ ℝ²; x₁ + x₂ = 1} mit der üblichen Addition und Skalarmultiplikation ein Vektorraum über ℝ? Begründe.', '{"begruendung_fehlt"}'::text[]),
('e2-09', '{"9"}'::smallint[], 'erklaere', 'Was ist der Unterschied zwischen der Null im Körper und dem Nullvektor? Gib für den Vektorraum ℝ² über ℝ beide an.', '{"begriff_unpraezise"}'::text[]),
('e2-10', '{"9"}'::smallint[], 'anwendung', 'Inwiefern kann man Funktionen wie f(x) = x² als Vektoren auffassen? Erkläre, wie Addition und Vielfache in Abb(ℝ, ℝ) definiert sind.', '{"begriff_unpraezise"}'::text[]),
('e2-11', '{"9"}'::smallint[], 'janein', 'Warum fordert man in einem Vektorraum ausdrücklich 1 · x = x? Was würde ohne dieses Axiom mit „n · x“ unklar bleiben?', '{"begruendung_fehlt"}'::text[]),
('e2-12', '{"9"}'::smallint[], 'rechnung', 'Berechne in ℝ³ komponentenweise 2 · (1, −1, 3) + (−1) · (0, 2, 1). Welche Vektorraum-Verknüpfungen benutzt du?', '{"rechenfehler"}'::text[]),
('e2-13', '{"7","9"}'::smallint[], 'verknuepfung', 'Warum ist die Lösungsmenge eines LGS mit rechter Seite 0 eine abelsche Gruppe? Welche Eigenschaften musst du dafür prüfen?', '{"begruendung_fehlt"}'::text[]),
('e2-14', '{"8","9"}'::smallint[], 'verknuepfung', 'ℂ kann man als Vektorraum über ℝ auffassen. Was sind dabei die Vektoren, was die Skalare, und wie passt das zur Gaußschen Zahlenebene?', '{"begriff_unpraezise"}'::text[])
on conflict (id) do nothing;

insert into public.begriffe (id, begriff, kapitel) values
('g-absolutbetrag-komplex', 'Absolutbetrag einer komplexen Zahl', 8),
('g-gausssche-zahlenebene', 'Gaußsche Zahlenebene', 8),
('g-dreiecksungleichungen-c', 'Dreiecksungleichungen in ℂ', 8),
('g-c-nicht-angeordnet', 'Anordnung (ℂ ist nicht angeordnet)', 8),
('g-stellenwertsystem', 'Stellenwertsystem (b-adische Darstellung)', 8),
('g-dualsystem', 'Dualsystem (Binärsystem)', 8),
('g-hexadezimalsystem', 'Hexadezimalsystem', 8),
('g-gruppenhomomorphismus', 'Gruppenhomomorphismus', 8),
('g-lgs', 'Lineares Gleichungssystem (LGS)', 9),
('g-einsetzungsverfahren', 'Einsetzungsverfahren', 9),
('g-gleichsetzungsverfahren', 'Gleichsetzungsverfahren', 9),
('g-loesbarkeit-lgs', 'Lösbarkeit linearer Gleichungssysteme', 9),
('g-additivitaet', 'Additivität', 9),
('g-skalarmultiplikation', 'Skalarmultiplikation', 9),
('g-vektorraum', 'Vektorraum', 9),
('g-nullvektor', 'Nullvektor', 9),
('g-vektor-skalar', 'Vektor und Skalar', 9),
('g-kn', 'Kⁿ (Vektorraum der n-Tupel)', 9),
('g-abb-x-v', 'Abb(X, V) (Funktionenraum)', 9)
on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- KI-Fragevarianten: nur für die Person sichtbar, für die sie erzeugt wurden.
-- Anlegen ausschließlich über die Edge Function „variante“ (service_role).
-- ---------------------------------------------------------------
create table if not exists public.fragen_varianten (
  id              text primary key check (id ~ '^var-[a-z0-9]{8,20}$'),
  user_id         uuid not null references auth.users(id) on delete cascade,
  basis_frage_id  text not null references public.fragen(id) on delete cascade,
  kapitel         smallint[] not null,
  format          text not null check (format in ('erklaere','rechnung','janein','anwendung','alltag','verknuepfung')),
  text            text not null check (length(text) between 5 and 1000),
  fallen          text[] not null default '{}',
  erstellt_am     timestamptz not null default now()
);
create index if not exists fragen_varianten_user on public.fragen_varianten (user_id, erstellt_am);
alter table public.fragen_varianten enable row level security;
drop policy if exists varianten_lesen on public.fragen_varianten;
create policy varianten_lesen on public.fragen_varianten for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists varianten_loeschen on public.fragen_varianten;
create policy varianten_loeschen on public.fragen_varianten for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.fragen_varianten from anon, authenticated;
revoke all on public.fragen_varianten from anon;
