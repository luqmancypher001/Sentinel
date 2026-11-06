# Sentinel — Secure Authentication & Anomaly Detection Dashboard

Final year project: an adaptive-authentication system that pairs password + TOTP
multi-factor login with a real-time risk-scoring engine, and a dashboard for
reviewing login history, trusted devices, and security alerts.

## Features

- **Password + TOTP MFA** (RFC 6238, compatible with Google Authenticator/Authy), with bcrypt-hashed one-time recovery codes as a fallback
- **Risk-based login pipeline** — every login is scored 0–100 and routed to `ALLOW` / `MFA_CHALLENGE` / `BLOCK` based on:
  - Unfamiliar device fingerprint
  - Impossible travel (Haversine distance/speed between consecutive logins, commercial-flight-speed threshold)
  - New country/city
  - Recent failed-attempt history
  - Off-hours login on an unfamiliar device
- **Persistent rate limiting & account lockout** (survives restarts — not an in-memory cache)
- **Password reset** via a single-use, time-limited emailed token
- **Session revocation that actually revokes** — logout invalidates the session server-side, not just the cookie
- **Audit trail** — every login attempt, device, and security alert is logged and exportable as CSV
- **Demo location simulator** — switch the "current" login location (London/Lagos/Manchester/New York/Tokyo) to trigger anomaly scenarios without needing real geographically-distributed IPs

## Getting started

```bash
npm install
cp .env.example .env   # set JWT_SECRET at minimum — see below
npx prisma generate
npx prisma db push
npm run seed            # creates the demo account
npm run dev
```

Open http://localhost:3000. Demo account: `jordan@acme.co` / `Password123!` (MFA enabled — the seed script prints a TOTP secret you can add to an authenticator app, or use the recovery codes `A1B2-C3D4`, `E5F6-G7H8`, `J9K0-L1M2`, `N3P4-Q5R6`).

### Environment variables

See `.env.example`. Only `JWT_SECRET` is required to run in production; everything else has a working local-dev default (including password-reset and security-alert emails, which log to the console when no email provider is configured).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run seed` | (Re)seed the demo account and sample data |
| `npm test` | Unit tests (anomaly engine, impossible-travel math, rate limiter) |
| `npm run test:security` | End-to-end smoke test of the security pipeline against the seeded demo user |

## Architecture

- `lib/anomaly.ts` — composite risk-scoring engine (`evaluateLoginAnomaly`)
- `lib/travel.ts` — Haversine distance + impossible-travel velocity check
- `lib/fingerprint.ts` — device fingerprinting from the User-Agent
- `lib/geoip.ts` — IP geolocation, with simulated-location overrides for the demo
- `lib/rate-limiter.ts` — Prisma-backed IP/account rate limiting and lockout
- `lib/auth.ts` — password hashing, TOTP, session/MFA-challenge JWTs, TOTP-secret encryption at rest
- `lib/email.ts` — pluggable email sender (console log in dev, plain SMTP via `nodemailer` if `SMTP_HOST` is configured)
- `app/api/auth/*`, `app/api/dashboard/*` — the API routes above compose into
- `proxy.ts` — security headers (CSP, HSTS, etc.) and a same-origin check on mutating API requests
- `app/page.tsx` + `components/dashboard/*`, `components/auth/*` — the dashboard UI and sign-in/MFA/password-reset flows
- `prisma/schema.prisma` — SQLite data model (`User`, `Session`, `Device`, `LoginLog`, `SecurityAlert`, `RecoveryCode`, `RateLimitBucket`, `PasswordResetToken`)

This project targets **Next.js 16**, which has breaking changes from earlier
versions (e.g. `middleware.ts` → `proxy.ts`). See `node_modules/next/dist/docs/`
for the version actually installed if something looks unfamiliar.

## Known limitations

These are deliberate scope cuts for a project of this size, not oversights:

- SQLite + a single server instance — fine for a demo/defense, not multi-instance production deployment
- Rate limiting is a fixed window, not a true sliding window (a burst right at a window boundary can slip through)
- No email verification on registration
- CSP allows `'unsafe-inline'` for scripts/styles (Next's hydration bootstrap needs it); tightening to per-request nonces wasn't worth the added complexity here
