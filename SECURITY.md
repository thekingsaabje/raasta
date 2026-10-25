# Security and privacy

Implemented
- Passwords: PBKDF2-SHA256, 100k iterations (workerd max), 16-byte salt, constant-time compare. Min length 10.
- Sessions: 32-byte random token in HttpOnly, SameSite=Lax, Secure (on https) cookie; only its SHA-256 is stored; 14-day expiry; logout deletes it.
- CSRF: non-GET requests must be JSON and, when an Origin header is present, same-origin.
- Authorisation: `/api/me/*` requires a session and every query is scoped by `user_id`; `/api/admin/*` requires role=admin (server-side). Admin role only via `ADMIN_EMAILS` secret at registration.
- Students cannot set `verified_status`; assisted/managed modes are refused; stage ≥ submitted needs evidence text.
- Input validation with zod on every write (strict profile schema); safe error responses; no request bodies logged.
- Rate limits (D1): register 10/h/IP, login 8/15min per IP+email, error reports 10/h/IP.
- Audit log for admin changes and account deletion; version history for scholarship and rule edits.
- Privacy: data minimisation (all profile fields optional, no uploads, no bank statements, no portal passwords); JSON export; account deletion cascades.
- Source monitor treats fetched pages as untrusted: they are normalised and hashed only; nothing from a page is executed or obeyed. Bounded to 20 fetches/run with 15s timeouts.
- Security headers: nosniff, strict referrer policy, no-store on API.

Not yet done (see TODO.md)
- Email verification and password reset (needs an email provider, e.g. Resend — requires approval).
- Content-Security-Policy header for the SPA; 2FA for admins.
- D1 backups: use D1 Time Travel (point-in-time restore, included on Workers plans) — document restore drill.
- Legal review of the privacy notice against Pakistan PECA/draft PDPB, EU GDPR and China PIPL before real users at scale.
