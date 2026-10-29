export interface Env {
  DB: D1Database;
  /** Workers AI binding, used only for PDF-to-text conversion (free plan; fails rather than bills when the allowance runs out). */
  AI?: Ai;
  ASSETS?: Fetcher;
  APP_ENV: string;
  PAYMENTS_ENABLED: string;
  AI_ENABLED: string;
  /** Comma-separated emails that become admin on registration. Set as a secret. */
  ADMIN_EMAILS?: string;
  /** Password-hash work factor (20k–100k). Lower only if the Workers CPU limit is hit. */
  PBKDF2_ITERATIONS?: string;
  /** Sign-ups allowed per IP per hour (default 20). */
  REGISTER_LIMIT_PER_HOUR?: string;
  /** Sources checked per cron run (1–10). */
  MONITOR_BATCH?: string;
  QUOTE_CHECK_BATCH?: string;
  /** Tavily search key (secret, optional). Without it discovery reads registered official sources only. */
  TAVILY_API_KEY?: string;
  /** Hard monthly stop for open-web searches (default 900, max 1000 = Tavily free plan). */
  SEARCH_MONTHLY_CAP?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };
