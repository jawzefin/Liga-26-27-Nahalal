// Pure logic shared by the site (app.js) and the update script / tests. No DOM, no I/O.
// Round shape: { n, games: [{ home, away, date: "YYYY-MM-DD", time: "HH:MM"|null, venue: string|null, hs: int|null, as: int|null, ex?: true }] }
// home/away are IFA team ids (strings), see data/teams.json.

const TZ = "Asia/Jerusalem";
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// "2026-10-17T05:30:00.000Z" -> { date: "2026-10-17", time: "08:30" }. hasTime=false => time null (the API sends a noon placeholder).
export function toLocal(iso, hasTime) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: hasTime ? `${p.hour}:${p.minute}` : null };
}

// Raw API response -> rounds[] (sorted).
export function normalizeApi(api) {
  const by = new Map();
  for (const m of api.matches || []) {
    const { date, time } = toLocal(m.dateTime, m.hasTime);
    const g = { home: String(m.homeTeamId), away: String(m.awayTeamId), date, time, venue: m.venue || null,
      hs: Number.isInteger(m.homeScore) ? m.homeScore : null, as: Number.isInteger(m.awayScore) ? m.awayScore : null };
    if (m.excludeFromLeagueTable) g.ex = true;
    if (!by.has(m.round)) by.set(m.round, []);
    by.get(m.round).push(g);
  }
  return [...by].map(([n, games]) => ({ n, games })).sort((a, b) => a.n - b.n);
}

// API rounds win; fallback fills the rounds the API does not publish yet.
export function mergeRounds(api, fallback) {
  const have = new Set(api.map(r => r.n));
  return [...api, ...fallback.filter(r => !have.has(r.n))].sort((a, b) => a.n - b.n);
}

// Returns a list of problems (empty = ok).
export function validate(rounds, teamIds, perRound = teamIds.length / 2) {
  const errs = [], ids = new Set(teamIds);
  if (!rounds.length) errs.push("no rounds");
  for (const r of rounds) {
    if (r.games.length !== perRound) errs.push(`round ${r.n}: ${r.games.length} games, expected ${perRound}`);
    const seen = new Set();
    for (const g of r.games) {
      for (const t of [g.home, g.away]) {
        if (!ids.has(t)) errs.push(`round ${r.n}: unknown team id ${t}`);
        if (seen.has(t)) errs.push(`round ${r.n}: team ${t} plays twice`);
        seen.add(t);
      }
      if (!/^\d{4}-\d\d-\d\d$/.test(g.date)) errs.push(`round ${r.n}: bad date ${g.date}`);
    }
  }
  return errs;
}

export const played = g => g.hs !== null && g.as !== null && !g.ex;

// Table. teams: { id: { name } }. Sort: points, goal difference, goals for, name.
// ponytail: official tie-break rules unknown; pointsAdjustments not applied until the format is known.
export function standings(rounds, teams) {
  const row = Object.fromEntries(Object.keys(teams).map(id => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, pct: 0, form: [] }]));
  const games = rounds.flatMap(r => r.games.map(g => ({ ...g, n: r.n }))).filter(played)
    .sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n);
  for (const g of games) {
    for (const [id, f, a] of [[g.home, g.hs, g.as], [g.away, g.as, g.hs]]) {
      const t = row[id]; if (!t) continue;
      t.p++; t.gf += f; t.ga += a;
      const r = f > a ? "W" : f < a ? "L" : "D";
      t[r.toLowerCase()]++; t.pts += r === "W" ? 3 : r === "D" ? 1 : 0; t.form.push(r);
    }
  }
  const out = Object.values(row);
  for (const t of out) { t.gd = t.gf - t.ga; t.pct = t.p ? Math.round(100 * t.pts / (3 * t.p)) : 0; t.form = t.form.slice(-5); }
  out.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || teams[a.id].name.localeCompare(teams[b.id].name, "he"));
  out.forEach((t, i) => (t.pos = i + 1));
  return out;
}

export const anyPlayed = rounds => rounds.some(r => r.games.some(played));

// All games of one team, oldest first.
export function teamGames(rounds, id) {
  return rounds.flatMap(r => r.games.filter(g => g.home === id || g.away === id).map(g => ({ ...g, n: r.n })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n);
}

export const nextGame = (games, today) => games.find(g => !played(g) && g.date >= today) || null;
export const lastGames = (games, k = 5) => games.filter(played).slice(-k).reverse();

// Index of the round to open by default: the latest round that has already started (any game dated today or earlier),
// so a finished round stays on screen, with its results, until the next one begins. Before the season starts: the first round.
export function currentRound(rounds, today) {
  let idx = 0;
  rounds.forEach((r, i) => { if (r.games.some(x => x.date <= today)) idx = i; });
  return idx;
}

// Most common venue of the team's home games (ties: the latest one). null when the API gave none.
export function homeVenue(games, id) {
  const c = new Map();
  for (const g of games) if (g.home === id && g.venue) c.set(g.venue, (c.get(g.venue) || 0) + 1);
  let best = null;
  for (const [v, k] of c) if (!best || k >= c.get(best)) best = v;
  return best;
}

// API payload + teams + fallback rounds -> {rounds, meta, errs}. Shared by the update script and /api/schedule.
export function buildSchedule(api, teams, fallback) {
  const norm = normalizeApi(api), rounds = mergeRounds(norm, fallback);
  return { rounds, errs: validate(rounds, Object.keys(teams)),
    meta: { showSuccessPercentage: !!api.league?.showSuccessPercentage, pointsAdjustments: api.league?.pointsAdjustments || [], apiRounds: norm.length } };
}
