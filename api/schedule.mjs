// Live schedule for the site: fetches the league API, caches at Vercel's CDN, falls back to the committed data/schedule.json.
// Game days (Fri-Sun, Israel time) refresh every 2 min; the rest of the week every hour.
import { buildSchedule } from "../lib.mjs";

const API = `https://junior-league-api-server-928016183646.us-central1.run.app/api/public/leagues/${encodeURIComponent("ליגת ילדים ב' שרון")}/matches?season=28`;

export default {
  async fetch(req) {
    const origin = new URL(req.url).origin;
    const json = async p => (await fetch(origin + p)).json();
    try {
      const res = await fetch(API, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const { rounds, meta, errs } = buildSchedule(await res.json(), await json("/data/teams.json"), (await json("/data/fallback-rounds.json")).rounds);
      if (errs.length) throw new Error(errs.join("; "));
      const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Jerusalem" }).format();
      const s = ["Fri", "Sat", "Sun"].includes(day) ? 120 : 3600;
      return Response.json({ updatedAt: new Date().toISOString(), meta, rounds }, { headers: { "cache-control": `public, s-maxage=${s}, stale-while-revalidate=${s * 5}` } });
    } catch (e) {
      console.error(e);
      return Response.json(await json("/data/schedule.json"), { headers: { "cache-control": "public, s-maxage=60" } });
    }
  },
};
