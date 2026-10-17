import test from "node:test";
import assert from "node:assert/strict";
import { toLocal, normalizeApi, mergeRounds, validate, standings, anyPlayed, teamGames, nextGame, lastGames, homeVenue, currentRound } from "../lib.mjs";

const T = { A: { name: "א" }, B: { name: "ב" }, C: { name: "ג" }, D: { name: "ד" } };
const g = (home, away, date, hs = null, as = null, extra = {}) => ({ home, away, date, time: null, venue: null, hs, as, ...extra });

test("toLocal: summer UTC+3, winter UTC+2, no time => null", () => {
  assert.deepEqual(toLocal("2026-10-17T05:30:00.000Z", true), { date: "2026-10-17", time: "08:30" });
  assert.deepEqual(toLocal("2026-12-05T10:00:00.000Z", true), { date: "2026-12-05", time: "12:00" });
  assert.deepEqual(toLocal("2026-10-17T09:00:00.000Z", false), { date: "2026-10-17", time: null });
  assert.equal(toLocal("2026-10-17T22:30:00.000Z", false).date, "2026-10-18"); // crosses midnight in Israel
});

test("normalizeApi maps ids, scores, venue and the exclude flag", () => {
  const api = { matches: [
    { homeTeamId: "A", awayTeamId: "B", dateTime: "2026-10-17T05:30:00.000Z", hasTime: true, venue: "אצטדיון", homeScore: 2, awayScore: 0, round: 2, excludeFromLeagueTable: false },
    { homeTeamId: "C", awayTeamId: "D", dateTime: "2026-10-10T09:00:00.000Z", hasTime: false, venue: null, homeScore: null, awayScore: null, round: 1, excludeFromLeagueTable: true },
  ] };
  const r = normalizeApi(api);
  assert.deepEqual(r.map(x => x.n), [1, 2]);
  assert.deepEqual(r[1].games[0], { home: "A", away: "B", date: "2026-10-17", time: "08:30", venue: "אצטדיון", hs: 2, as: 0 });
  assert.equal(r[0].games[0].ex, true);
});

test("mergeRounds: API wins, fallback fills the rest", () => {
  const api = [{ n: 1, games: [g("A", "B", "2026-10-17")] }];
  const fb = [{ n: 1, games: [g("B", "A", "2026-01-01")] }, { n: 2, games: [g("C", "D", "2026-10-24")] }];
  const m = mergeRounds(api, fb);
  assert.deepEqual(m.map(r => r.n), [1, 2]);
  assert.equal(m[0].games[0].home, "A");
});

test("validate catches unknown ids, wrong game count, double play, bad dates, empty", () => {
  const ids = Object.keys(T);
  assert.deepEqual(validate([{ n: 1, games: [g("A", "B", "2026-10-17"), g("C", "D", "2026-10-17")] }], ids), []);
  assert.match(validate([], ids)[0], /no rounds/);
  assert.match(validate([{ n: 1, games: [g("A", "B", "2026-10-17")] }], ids)[0], /1 games, expected 2/);
  assert.ok(validate([{ n: 1, games: [g("A", "X", "2026-10-17"), g("C", "D", "2026-10-17")] }], ids).some(e => /unknown team id X/.test(e)));
  assert.ok(validate([{ n: 1, games: [g("A", "B", "2026-10-17"), g("A", "D", "2026-10-17")] }], ids).some(e => /plays twice/.test(e)));
  assert.ok(validate([{ n: 1, games: [g("A", "B", "17/10/26"), g("C", "D", "2026-10-17")] }], ids).some(e => /bad date/.test(e)));
});

test("standings: points, goal difference, ordering, form, unplayed/excluded ignored", () => {
  const rounds = [
    { n: 1, games: [g("A", "B", "2026-10-17", 3, 0), g("C", "D", "2026-10-17", 1, 1)] },
    { n: 2, games: [g("A", "C", "2026-10-24", 0, 2), g("B", "D", "2026-10-24", 1, 1, { ex: true })] },
    { n: 3, games: [g("A", "D", "2026-10-31"), g("B", "C", "2026-10-31")] },
  ];
  const t = standings(rounds, T), by = Object.fromEntries(t.map(r => [r.id, r]));
  assert.deepEqual(t.map(r => r.id), ["C", "A", "D", "B"]); // C 4pts, A 3pts, D 1pt, B 0pts
  assert.deepEqual([by.C.p, by.C.w, by.C.d, by.C.pts, by.C.gf, by.C.ga, by.C.gd], [2, 1, 1, 4, 3, 1, 2]);
  assert.deepEqual([by.A.pts, by.A.gd, by.A.form.join("")], [3, 1, "WL"]);
  assert.equal(by.D.p, 1); // excluded game not counted
  assert.equal(by.C.pct, Math.round(100 * 4 / 6));
  assert.deepEqual(t.map(r => r.pos), [1, 2, 3, 4]);
});

test("standings: goal difference breaks equal points, then goals for, then name", () => {
  const r = [{ n: 1, games: [g("A", "B", "2026-10-17", 1, 0), g("C", "D", "2026-10-17", 5, 0)] }];
  assert.deepEqual(standings(r, T).map(x => x.id), ["C", "A", "B", "D"]); // C gd+5, A gd+1, then B(0)/D(-5)? B gd-1 > D gd-5
  const eq = [{ n: 1, games: [g("A", "B", "2026-10-17", 1, 1), g("C", "D", "2026-10-17", 1, 1)] }];
  assert.deepEqual(standings(eq, T).map(x => x.id), ["A", "B", "C", "D"]); // all equal => by name
});

test("standings before any result: all zeros, alphabetical; anyPlayed false", () => {
  const r = [{ n: 1, games: [g("B", "A", "2026-10-17"), g("D", "C", "2026-10-17")] }];
  assert.equal(anyPlayed(r), false);
  const t = standings(r, T);
  assert.deepEqual(t.map(x => x.id), ["A", "B", "C", "D"]);
  assert.ok(t.every(x => x.p === 0 && x.pts === 0));
});

test("teamGames / nextGame / lastGames / homeVenue", () => {
  const rounds = [
    { n: 1, games: [g("A", "B", "2026-10-17", 2, 1, { venue: "מגרש 1" })] },
    { n: 2, games: [g("C", "A", "2026-10-24", 0, 0)] },
    { n: 3, games: [g("A", "D", "2026-10-31", null, null, { venue: "מגרש 2" })] },
    { n: 4, games: [g("A", "B", "2026-11-07", null, null, { venue: "מגרש 1" })] },
  ];
  const gs = teamGames(rounds, "A");
  assert.deepEqual(gs.map(x => x.n), [1, 2, 3, 4]);
  assert.equal(nextGame(gs, "2026-10-25").n, 3);
  assert.equal(nextGame(gs, "2026-10-31").n, 3); // today counts
  assert.equal(nextGame(gs, "2027-01-01"), null);
  assert.deepEqual(lastGames(gs).map(x => x.n), [2, 1]); // newest first
  assert.equal(homeVenue(gs, "A"), "מגרש 1");
  assert.equal(homeVenue(gs, "B"), null);
});

test("currentRound: latest round that has started", () => {
  const rounds = [
    { n: 1, games: [g("A", "B", "2026-10-16", 1, 0), g("C", "D", "2026-10-26")] },
    { n: 2, games: [g("A", "C", "2026-10-28")] },
    { n: 3, games: [g("A", "D", "2026-11-04")] },
  ];
  assert.equal(currentRound(rounds, "2026-10-01"), 0); // before the season: first round
  assert.equal(currentRound(rounds, "2026-10-17"), 0); // round 1 started, its results stay up
  assert.equal(currentRound(rounds, "2026-10-27"), 0); // still round 1 until round 2 begins
  assert.equal(currentRound(rounds, "2026-10-28"), 1); // round 2's first game day
  assert.equal(currentRound(rounds, "2027-06-01"), 2); // after the season: last round
});
