// Pulls the schedule from the public junior-league API and writes data/schedule.json.
// Run by .github/workflows/update-schedule.yml (and by hand: node scripts/update-schedule.mjs).
// Safe by design: any problem => exit 1 and the last good data/schedule.json is left untouched.
import { readFile, writeFile } from "node:fs/promises";
import { buildSchedule } from "../lib.mjs";

const LEAGUE = "ליגת ילדים ב' שרון", SEASON = 28;
const API = `https://junior-league-api-server-928016183646.us-central1.run.app/api/public/leagues/${encodeURIComponent(LEAGUE)}/matches?season=${SEASON}`;
const OUT = new URL("../data/schedule.json", import.meta.url);
const read = async p => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));

async function fetchApi() {
  let err;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(API, { signal: AbortSignal.timeout(20000), headers: { accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) { err = e; await new Promise(r => setTimeout(r, 2000 * i)); }
  }
  throw new Error("API unreachable: " + err);
}

// one round per line keeps git diffs readable
const serialize = d => `{"updatedAt":${JSON.stringify(d.updatedAt)},"meta":${JSON.stringify(d.meta)},"rounds":[\n${d.rounds.map(r => JSON.stringify(r)).join(",\n")}\n]}\n`;

const api = await fetchApi();
const teams = await read("../data/teams.json");
const fallback = (await read("../data/fallback-rounds.json")).rounds;
const { rounds, meta, errs } = buildSchedule(api, teams, fallback);
if (errs.length) { console.error("validation failed:\n" + errs.join("\n")); process.exit(1); }
let old = null;
try { old = await read("../data/schedule.json"); } catch {}
if (old && JSON.stringify({ meta: old.meta, rounds: old.rounds }) === JSON.stringify({ meta, rounds })) {
  console.log("no change"); process.exit(0);
}
await writeFile(OUT, serialize({ updatedAt: new Date().toISOString(), meta, rounds }));
console.log(`updated: ${rounds.length} rounds (${meta.apiRounds} from API)`);
