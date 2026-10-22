// Temporary probe: does football.org.il answer (or 403) when fetched from Vercel? Returns status/headers only, never the page body.
const FA = "https://www.football.org.il/team-details/?itemid=%7B2AE09DED-5019-4C49-BFD5-4458C66F9D24%7D&team_id=2883";

export default {
  async fetch() {
    try {
      const res = await fetch(FA, { signal: AbortSignal.timeout(8000), headers: { "accept-language": "he-IL,he;q=0.9", "user-agent": "Mozilla/5.0 (compatible; liga-probe)" } });
      await res.body?.cancel();
      return Response.json({ status: res.status, contentType: res.headers.get("content-type"), server: res.headers.get("server") }, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: { "cache-control": "no-store" } });
    }
  },
};
