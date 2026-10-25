# Security and privacy

Implemented
- Passwords: PBKDF2-SHA256, 100k iterations (workerd max), 16-byte salt, constant-time compare. Min length 10.
- Sessions: 32-byte random token in HttpOnly, SameSite=Lax, Secure (on https) cookie; only its SHA-256 is stored; 14-day expiry; logout deletes it.
- CSRF: non-GET requests must be JSON and, when an Origin header is present, same-origin.
- Authorisation: `/api/me/*` requires a session and every query is scoped by `user_id`; `/api/admin/*` requires role=admin (server-side). Admin role via `ADMIN_EMAILS` (local dev only) or a one-off D1 update in production — `ADMIN_EMAILS` must stay unset in production until email ownership is verified, otherwise whoever registers that address first becomes admin.
- Password hashes store their own iteration count (`<iter>$<hash>`), so `PBKDF2_ITERATIONS` can be tuned to the Workers CPU limit without breaking accounts.
- Students cannot set `verified_status`; assisted/managed modes are refused; stage ≥ submitted needs evidence text.
- Input validation with zod on every write (strict profile schema); safe error responses; no request bodies logged.
- Rate limits (D1): register 10/h/IP, login 8/15min per IP+email, error reports 10/h/IP.
- Audit log for admin changes and account deletion; version history for scholarship and rule edits.
- Privacy: data minimisation (all profile fields optional, no uploads, no bank statements, no portal passwords); JSON export; account deletion cascades.
- Source monitor treats fetched pages as untrusted: they are normalised and hashed only; nothing from a page is executed or obeyed. Bounded to 20 fetches/run with 15s timeouts.
- Security headers: nosniff, strict referrer policy, no-store on API.

- Password recovery (no email provider yet): an admin issues a single-use, 24-hour reset link (only its SHA-256 is stored),
  hands it over out of band after confirming identity; using it changes the password and signs out every session. Audited.
- Backups: `wrangler d1 export raasta-db --remote --output backups/<date>.sql` before every production change; restore was
  rehearsed on 2026-10-25 by loading the export into a separate local D1 and applying migrations (counts matched).
  D1 Time Travel offers point-in-time restore as a second line (see Cloudflare docs for retention on the current plan).

Not yet done (see TODO.md)
- Email verification and self-service password reset (needs an email provider, e.g. Resend — requires approval).
- Content-Security-Policy header for the SPA; 2FA for admins.
- D1 backups: use D1 Time Travel (point-in-time restore, included on Workers plans) — document restore drill.
- Legal review of the privacy notice against Pakistan PECA/draft PDPB, EU GDPR and China PIPL before real users at scale.
