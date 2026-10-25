export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  APP_ENV: string;
  PAYMENTS_ENABLED: string;
  AI_ENABLED: string;
  /** Comma-separated emails that become admin on registration. Set as a secret. */
  ADMIN_EMAILS?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };
