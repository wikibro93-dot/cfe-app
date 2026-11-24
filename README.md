# Community Food Exchange (CFE)

Share homemade dishes with neighbours. A cook posts a dish, nearby users
browse a feed or a map, request it, and pick it up — paying with credits,
a direct swap, or for free. New users start with 10 credits; cooks earn
credits when a dish is picked up.

> **Security status (branch `fix/critical-security`, not yet merged):** the
> original code had unsigned JWTs, a mock OTP, passwordless login, fake
> Stripe credit purchases and a committed database credential. Those are
> fixed on this branch — see the PR description. Do **not** deploy `main`
> to real users until that PR is merged and the checklist below is done.

## Stack

Next.js 16 / React 19 / TypeScript, Tailwind 4, Prisma 7 + Neon Postgres,
Upstash Redis (rate limiting), Leaflet maps, Cloudinary uploads, Jest.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the real values (never commit .env)
npx prisma generate
npx prisma db push     # applies the schema; there are no migrations yet
npm run dev            # http://localhost:3000
```

## Environment variables

Copy `.env.example` and set every value. Required:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon). **Never commit a real one.** |
| `JWT_SECRET` | Random secret, min 32 chars: `openssl rand -base64 32`. Auth fails loudly without it. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS one-time codes. Login returns 503 until these are set. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Dish photo uploads (unsigned preset `cfe_dishes`). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting. Required in production; without them the app falls back to in-memory limits that reset on every cold start. |
| `EXCHANGE_RATES_API_KEY` | Currency conversion (exchangeratesapi.io). |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME` | Public URL and display name. |

## Before going live

1. **Rotate the Neon database credential.** A real connection string was
   committed in `prisma.config.ts` and in `.env.example` / `.history/` on
   `main`. Rotate it in Neon, delete the old credential, and set the new
   `DATABASE_URL` in Vercel. (Deleting the files does not remove the secret
   from git history.)
2. Set `JWT_SECRET`, Twilio and Upstash vars in Vercel.
3. Run `npx prisma generate && npx prisma db push` against the live database
   (this applies the new `OTP.attempts` column and the indexes).
4. Create the Cloudinary unsigned upload preset `cfe_dishes`.
5. Set the first admin by SQL: `UPDATE "User" SET role = ADMIN WHERE phone = +YOUR_PHONE;`
6. `npm run build` and `npm run test:ci` must pass.

## What is deliberately disabled

- **Credit purchase is disabled.** There is no Stripe integration; the old
  code minted credits from a client-supplied amount. `POST /api/credits`
  with `type: "PURCHASE"` returns 503. Credits are earned (welcome bonus,
  cooking) and spent/refunded through the swap ledger only. To sell credits,
  integrate Stripe PaymentIntents with server-side verification first.
- **Live push is disabled.** Socket.IO was dead code (no server on Vercel
  serverless). Chat and notifications use REST polling instead. `lib/socket.ts`
  now only holds shared chat types.
- **Passwordless login is removed.** Sign-in is SMS one-time code only
  (`/api/auth/send-otp` → `/api/auth/verify-otp`). The old
  `POST /api/auth/login` returns 410 Gone.

## Auth model

- JWT: HMAC-SHA256 via `jsonwebtoken`, 7-day expiry, signature + expiry
  verified on every request. The token is set as an `httpOnly`, `Secure` (in
  production), `SameSite=Lax` cookie — it is never stored in localStorage
  and never returned in a JSON body.
- OTP: crypto-secure 6-digit code, SHA-256 hash stored (never the plain
  code), 10-minute expiry, single-use, invalidated after 5 wrong attempts.
- Rate limits (Upstash, sliding window): send-otp 3/min, verify-otp 5/min,
  writes 30/min, search 60/min, general API 120/min.

## Tests

```bash
npm test        # Jest
npm run test:ci # Jest in CI mode with coverage
```
