# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js version note

This project uses **Next.js 16.4.3**, which postdates your training data and has breaking API/convention changes from the Next.js you know. Before writing code that touches routing, server/client component boundaries, config, or data fetching, check the bundled docs at `node_modules/next/dist/docs/` (e.g. `01-app/`) for the current API shape rather than assuming older Next.js behavior. Notably: `middleware.ts` is deprecated in v16 and renamed to `proxy.ts` (exporting a `proxy` function); it defaults to the Node.js runtime rather than Edge.

`pnpm` is configured as the package manager (`pnpm-lock.yaml`) but may not actually work in a given shell — if `pnpm -v` errors, fall back to `npm`/`npx` (there's also a `package-lock.json` kept in sync).

## Commands

- `npm run dev` — start dev server (webpack, bound to `0.0.0.0:3000`)
- `npm run build` — production build (webpack); fails on real TypeScript errors (`ignoreBuildErrors` was removed)
- `npm start` — run production build
- `npm run seed` — seed the SQLite dev database (`prisma/seed.mjs`), creates demo user `jordan@acme.co` / `Password123!` (prints a fresh TOTP secret each run — recovery codes are fixed: `A1B2-C3D4`, `E5F6-G7H8`, `J9K0-L1M2`, `N3P4-Q5R6`)
- `npm test` — Vitest unit tests (`lib/*.test.ts`): anomaly engine, impossible-travel math, rate limiter. The rate-limiter tests run against the real dev DB (no separate test DB is configured) using namespaced keys, cleaned up in `afterAll`.
- `npm run test:security` — `test-security-pipeline.mjs`, an end-to-end smoke-test script (not part of the Vitest suite) exercising the same pipeline against the seeded demo user. Requires the DB to be seeded first.
- `npx prisma db push --accept-data-loss` — sync schema changes to the dev DB. **There is no `prisma/migrations/` history** — schema changes are applied with `db push`, not `migrate dev` (which also doesn't work non-interactively in this environment). `npx prisma generate` regenerates the client after schema edits.

Relative imports between `lib/*.ts` files use an explicit `.ts` extension (e.g. `from './db.ts'`), which looks wrong but is required: `test-security-pipeline.mjs` and `lib/*.test.ts` import these files directly, and plain Node ESM resolution needs the extension. `tsconfig.json` sets `allowImportingTsExtensions: true` specifically so `next build`'s type check doesn't reject it. Keep new cross-file imports within `lib/` consistent with this (include the `.ts`), or the build/tests will break in whichever direction you dropped it.

## Architecture

This is "Sentinel," a single-tenant demo of an adaptive-authentication system: password + TOTP MFA login gated by a real-time risk-scoring engine, with a dashboard visualizing login history, devices, and security alerts.

**Risk-based auth pipeline** (`app/api/auth/login/route.ts` orchestrates all of this per request, in order):
1. IP-level and account-level rate limiting (`lib/rate-limiter.ts` — Prisma-backed fixed-window counters in the `RateLimitBucket` table, so limits survive restarts/multiple instances, unlike an in-memory Map)
2. Device fingerprinting from the User-Agent header (`lib/fingerprint.ts` — hashes UA + OS + browser into a 32-char fingerprint; note the browser/OS detection returns canned device names like "iPhone 15 Pro" rather than parsing precise models)
3. Geolocation resolution (`lib/geoip.ts` — uses `geoip-lite` for real IPs, but supports a `simulateLocation` preset param (`london`/`manchester`/`lagos`/`newyork`/`tokyo`) used throughout the app for demoing anomaly scenarios without real IP diversity)
4. Impossible-travel check via Haversine distance/speed (`lib/travel.ts`)
5. Composite anomaly scoring (`lib/anomaly.ts`'s `evaluateLoginAnomaly`) — combines unfamiliar-device, impossible-travel, new-country/city, repeated-failure, and off-hours signals into a 0–100 score, producing one of `ALLOW` / `MFA_CHALLENGE` / `BLOCK` (thresholds: <30 allow, 30–69 MFA, ≥70 block). Point values are tuned such that some single factors alone sit *below* their "obvious" threshold by design (e.g. impossible travel alone = 60, under the 70-point BLOCK line; multiple-failed-attempts caps at 25, under the 30-point MFA line) — see `lib/anomaly.test.ts` for the exercised combinations before assuming a factor should trigger a decision on its own.
6. Every attempt (success, fail, block, MFA-challenge) is written to `LoginLog`, and medium/high risk events additionally create a `SecurityAlert` and send an email via `lib/email.ts`

MFA step-up (`app/api/auth/verify-mfa/route.ts`) is driven by a short-lived (5 min) JWT "temp token" (`createMfaChallengeToken`/`verifyMfaChallengeToken` in `lib/auth.ts`) minted during login that carries the risk context (geo, device, score) forward so it can be logged once MFA passes. TOTP is real RFC 6238 (`otplib`), encrypted at rest (`encryptTotpSecret`/`decryptTotpSecret`, AES-256-GCM keyed from `TOTP_ENC_KEY` or `JWT_SECRET`), with bcrypt-hashed one-time recovery codes as a fallback credential.

**Session handling**: `requireSession()` in `lib/auth.ts` is the single auth-check path used by every protected API route — it verifies the JWT *and* checks the `Session` DB row still exists and is unexpired, so logout (which deletes that row) actually revokes access rather than just clearing the cookie. All three places that issue a session token (register, login's no-MFA success path, verify-mfa) must also insert the matching `Session` row, or `requireSession` will reject an otherwise-valid-looking token.

**Password reset**: `app/api/auth/forgot-password` and `/reset-password` use a single-use, 30-minute `PasswordResetToken` (hash stored, raw token only ever in the emailed link). Resetting a password invalidates all of that user's sessions (`Session.deleteMany`). The emailed link is `/?resetToken=...`; the client (`components/auth/AuthScreen.tsx`) reads that query param client-side via `window.location`, not `next/navigation`'s `useSearchParams` (avoids the Suspense-boundary requirement for a one-off deep link read).

**`proxy.ts`** (project root, replaces the deprecated `middleware.ts`) sets security headers (CSP, X-Frame-Options, etc.) and rejects cross-origin mutating API requests by comparing the `Origin` header against the request's own `Host` header — **not** `request.nextUrl.origin`, which reflects the dev server's bind address (`0.0.0.0` from `next dev -H 0.0.0.0`) rather than what the client actually requested, and would reject every legitimate same-origin request. The CSP's `script-src` includes `'unsafe-eval'` only when `NODE_ENV !== 'production'`, because webpack's Fast Refresh/HMR runtime needs it — a prod-only CSP would silently break dev without that carve-out (and did, during development: it broke all client-side event handlers by throwing a CSP `EvalError` on every page load).

**Data model** (`prisma/schema.prisma`, SQLite): `User` → `Session`, `Device` (unique per `userId`+`fingerprint`, used to detect "unfamiliar device"), `LoginLog` (the audit trail driving both anomaly history and the dashboard charts), `SecurityAlert`, `RecoveryCode`, `RateLimitBucket` (keyed `ip:<ip>` / `acct:<email>`), `PasswordResetToken`.

**Frontend**: `app/page.tsx` is the dashboard shell (sidebar nav, header, view routing, `/api/auth/me` + `/api/dashboard/stats` polling) at ~250 lines. Each dashboard view is its own component under `components/dashboard/` (`Overview`, `ActivityPage`, `AlertsPage`, `DevicesPage`, `SecuritySettings`, `AccountSettings`, plus shared `LoginTable` and `shared.tsx` primitives — `Badge`/`MetricCard`/`StatusDot`). The whole pre-auth flow (sign in, register, MFA, forgot/reset password) lives in `components/auth/AuthScreen.tsx`.

Dashboard API routes (`app/api/dashboard/*`) all go through `requireSession()` to scope data to the current user. `stats/route.ts` returns real DB aggregates only — it used to pad sparse data with hardcoded baseline numbers; don't reintroduce that. `app/api/dashboard/export/route.ts` streams the user's full `LoginLog` as CSV.

Session auth throughout: JWT signed via `getJwtSecret()` in `lib/auth.ts` (lazy — computed on first use, not at module load, so importing the module during `next build`'s page-data collection can't crash the build before a request needs it; throws in production if `JWT_SECRET` is unset, falls back to a dev-only default otherwise), stored as an httpOnly `sentinel_session` cookie, 12h expiry.
