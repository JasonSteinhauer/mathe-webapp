// Fortschritt: eigene Auswertung (nur die eigenen Daten, per RLS geschützt)
import { el, kapLabel, fmtDate, dayKey, KAPITEL, KAT_LABEL, FEHLERTYPEN, DAY } from "./ui";
import { zustand, LIMIT_PRO_TAG, type Antwort } from "./daten";

const KATS = ["richtig", "teilweise", "fehler", "offen"] as const;

function stackBar(label: string, counts: Record<string, number>, total: number, wide = false): HTMLElement {
  const stack = el("div", { class: "stack", role: "img", "aria-label": label + ": " + KATS.map((k) => (counts[k] || 0) + " " + KAT_LABEL[k]).join(", ") });
  for (const k of KATS) if (counts[k]) stack.append(el("i", { class: "s-" + k, style: "width:" + (counts[k] / Math.max(total, 1)) * 100 + "%" }));
  return el("div", { class: "bar" }, el("span", { class: "lbl" + (wide ? " wide" : "") }, label), stack, el("span", { class: "num" }, total));
}
const legend = () => el("div", { class: "legend" }, ...KATS.map((k) => el("span", null, el("i", { class: "s-" + k }), KAT_LABEL[k])));

function verlaufChart(a: Antwort[]): SVGSVGElement {
  const days: { key: string; d: Date; c: Record<string, number> }[] = [];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) { const d = new Date(now.getTime() - i * DAY); days.push({ key: dayKey(d.getTime()), d, c: { richtig: 0, teilweise: 0, fehler: 0, offen: 0 } }); }
  const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
  for (const x of a) { const i = idx[dayKey(x.ts)]; if (i !== undefined) days[i].c[x.kategorie] = (days[i].c[x.kategorie] || 0) + 1; }
  const maxV = Math.max(1, ...days.map((d) => d.c.richtig + d.c.teilweise + d.c.fehler + d.c.offen));
  const W = 560, H = 170, pl = 26, pb = 22, pt = 8, bw = (W - pl) / 14;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("width", "100%"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Antworten pro Tag, letzte 14 Tage"); svg.style.minWidth = "420px";
  const mk = (t: string, at: Record<string, string | number>) => { const n = document.createElementNS(ns, t); for (const k in at) n.setAttribute(k, String(at[k])); return n; };
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / maxV);
  [0, Math.ceil(maxV / 2), maxV].filter((v, i, arr) => arr.indexOf(v) === i).forEach((v) => {
    svg.append(mk("line", { x1: pl, x2: W, y1: y(v), y2: y(v), stroke: "var(--line)", "stroke-width": 1 }));
    const t = mk("text", { x: pl - 6, y: y(v) + 3, "text-anchor": "end" }); t.textContent = String(v); svg.append(t);
  });
  const col: Record<string, string> = { richtig: "var(--ok)", teilweise: "var(--mid)", fehler: "var(--bad)", offen: "var(--open)" };
  days.forEach((d, i) => {
    let acc = 0; const x = pl + i * bw + bw * 0.18, w = bw * 0.64;
    for (const k of KATS) { const v = d.c[k]; if (!v) continue; svg.append(mk("rect", { x, y: y(acc + v), width: w, height: y(acc) - y(acc + v), fill: col[k], rx: 1.5 })); acc += v; }
    if (i % 2 === 1 || i === 13) { const t = mk("text", { x: x + w / 2, y: H - 6, "text-anchor": "middle" }); t.textContent = d.d.getDate() + "." + (d.d.getMonth() + 1) + "."; svg.append(t); }
  });
  return svg;
}

export function renderFortschritt(view: HTMLElement): void {
  const a = zustand.antworten.slice().sort((x, y) => x.ts - y.ts);
  const total = a.length;
  const richtig = a.filter((x) => x.kategorie === "richtig").length;
  const geuebt = new Set(a.filter((x) => x.modus === "wander").map((x) => x.frage_id)).size;
  const woche = a.filter((x) => Date.now() - x.ts < 7 * DAY).length;
  const sec = el("div", { style: "display:flex;flex-direction:column;gap:16px" });
  sec.append(el("div", { class: "tiles" },
    el("div", { class: "tile" }, el("b", null, total), el("span", null, "Antworten gesamt")),
    el("div", { class: "tile" }, el("b", null, total ? Math.round((richtig / total) * 100) + " %" : "–"), el("span", null, "auf Anhieb richtig")),
    el("div", { class: "tile" }, el("b", null, geuebt + "/" + zustand.fragen.length), el("span", null, "Poolfragen geübt")),
    el("div", { class: "tile" }, el("b", null, woche), el("span", null, "Antworten in 7 Tagen"))));
  sec.append(el("p", { class: "muted small", style: "margin:0" }, `Prüfer heute: ${zustand.kiHeute} von ${LIMIT_PRO_TAG} Aufrufen genutzt (Zählung ab Mitternacht).`));
  if (!total) {
    sec.append(el("div", { class: "card" }, el("h2", null, "Noch keine Antworten"),
      el("p", { class: "muted", style: "margin:0" }, "Starte eine Wanderfrage-Runde. Danach siehst du hier, wie sicher du pro Kapitel bist und welche Fallen dich am häufigsten erwischen."),
      el("div", { class: "row" }, el("a", { href: "#wander" }, "Zur Wanderfrage-Runde"))));
    view.replaceChildren(sec); return;
  }
  const perKap = el("div", { class: "bars" });
  for (const v of KAPITEL) {
    const c: Record<string, number> = {}; let t = 0;
    for (const x of a) if (x.kapitel.includes(v)) { c[x.kategorie] = (c[x.kategorie] || 0) + 1; t++; }
    perKap.append(stackBar("Kap. " + v, c, t));
  }
  sec.append(el("section", { class: "card" }, el("h2", null, "Pro Kapitel"), legend(), perKap,
    el("p", { class: "muted small", style: "margin:0" }, "Bewertung der ersten Antwort. Verknüpfungsfragen zählen bei jedem beteiligten Kapitel.")));
  const ft: Record<string, number> = {};
  for (const x of a) { x.fehlertypen.forEach((f) => (ft[f] = (ft[f] || 0) + 1)); x.fehlertypen_nachfrage.forEach((f) => (ft[f] = (ft[f] || 0) + 1)); }
  const ftList = Object.entries(ft).sort((p, q) => q[1] - p[1]);
  const maxF = ftList.length ? ftList[0][1] : 1;
  const ftBars = el("div", { class: "bars" });
  for (const [k, n] of ftList) ftBars.append(el("div", { class: "bar" }, el("span", { class: "lbl wide" }, FEHLERTYPEN[k] ?? k), el("div", { class: "stack" }, el("i", { class: "s-fehler", style: "width:" + (n / maxF) * 100 + "%" })), el("span", { class: "num" }, n)));
  sec.append(el("section", { class: "card" }, el("h2", null, "Fallen, die dich erwischen"), ftList.length ? ftBars : el("p", { class: "muted", style: "margin:0" }, "Noch kein Fehlertyp markiert.")));
  sec.append(el("section", { class: "card" }, el("h2", null, "Verlauf der letzten 14 Tage"), legend(), el("div", { class: "chartbox" }, verlaufChart(a))));
  const stufen = [0, 0, 0, 0, 0];
  Object.values(zustand.karten).forEach((c) => { if (c.stufe >= 1 && c.stufe <= 5) stufen[c.stufe - 1]++; });
  const kb = el("div", { class: "bars" }); const maxS = Math.max(1, ...stufen);
  stufen.forEach((n, i) => kb.append(el("div", { class: "bar" }, el("span", { class: "lbl" }, "Stufe " + (i + 1)), el("div", { class: "stack" }, el("i", { style: "background:var(--accent);width:" + (n / maxS) * 100 + "%" })), el("span", { class: "num" }, n))));
  sec.append(el("section", { class: "card" }, el("h2", null, "Glossar-Karten"), el("p", { class: "muted small", style: "margin:0" }, Object.keys(zustand.karten).length + " von " + zustand.begriffe.length + " Begriffen im Kasten"), kb));
  const list = el("div", { class: "list" });
  a.slice(-10).reverse().forEach((x) => list.append(el("div", null,
    el("div", { class: "row" }, el("span", { class: "pill " + x.kategorie }, KAT_LABEL[x.kategorie] || x.kategorie), el("span", { class: "tag" }, kapLabel(x.kapitel)), el("span", { class: "muted small" }, fmtDate(x.ts)), x.zu_viel_verraten ? el("span", { class: "trap" }, "zu viel verraten") : null),
    el("span", { class: "small" }, x.frage))));
  sec.append(el("section", { class: "card" }, el("h2", null, "Letzte Antworten"), list));
  view.replaceChildren(sec);
}
