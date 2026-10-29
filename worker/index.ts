import { app } from "./app";
import type { Env } from "./env";
import { runSourceChecks } from "./monitor";
import { runQuoteChecks } from "./quotecheck";

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Bounded per run (free-tier CPU/subrequest limits); runs several times a day to cover the registry.
    const limit = Math.min(10, Math.max(1, Number(env.MONITOR_BATCH) || 6));
    // The cron fires hourly. Source monitoring keeps its old pace (every 4 hours); the quote check runs every hour.
    if (new Date(event.scheduledTime).getUTCHours() % 4 === 0)
      ctx.waitUntil(
        runSourceChecks(env.DB, limit)
          .then((r) => console.log(JSON.stringify({ job: "source_checks", cron: event.cron, checked: r.checked, ok: r.results.filter((x) => x.ok).length, changed: r.results.filter((x) => x.changed).length, deadlinePassed: r.deadlinePassed })))
          .catch((e) => console.error(JSON.stringify({ job: "source_checks", error: e instanceof Error ? e.message : "unknown" }))),
      );
    // Official-page quote check ("Auto-checked" badge): 2 scholarships an hour, oldest check first, so every record is
    // re-read at least once a day (48 a day) within free-plan CPU and subrequest limits.
    ctx.waitUntil(
      runQuoteChecks(env.DB, Math.min(6, Math.max(1, Number(env.QUOTE_CHECK_BATCH) || 2)))
        .then((r) => console.log(JSON.stringify({ job: "quote_checks", cron: event.cron, results: r.map((x) => x && `${x.id}:${x.result}`) })))
        .catch((e) => console.error(JSON.stringify({ job: "quote_checks", error: e instanceof Error ? e.message : "unknown" }))),
    );
  },
} satisfies ExportedHandler<Env>;
