import { app } from "./app";
import type { Env } from "./env";
import { runSourceChecks } from "./monitor";

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Bounded: at most 20 pages per run keeps the free-tier subrequest budget safe.
    ctx.waitUntil(runSourceChecks(env.DB, 20).then((r) => console.log("source checks", r.checked)));
  },
} satisfies ExportedHandler<Env>;
