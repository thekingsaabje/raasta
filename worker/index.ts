import { app } from "./app";
import type { Env } from "./env";
import { runSourceChecks } from "./monitor";

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Bounded per run (free-tier CPU/subrequest limits); runs several times a day to cover the registry.
    const limit = Math.min(10, Math.max(1, Number(env.MONITOR_BATCH) || 6));
    ctx.waitUntil(
      runSourceChecks(env.DB, limit)
        .then((r) => console.log(JSON.stringify({ job: "source_checks", cron: event.cron, checked: r.checked, ok: r.results.filter((x) => x.ok).length, changed: r.results.filter((x) => x.changed).length, deadlinePassed: r.deadlinePassed })))
        .catch((e) => console.error(JSON.stringify({ job: "source_checks", error: e instanceof Error ? e.message : "unknown" }))),
    );
  },
} satisfies ExportedHandler<Env>;
