# League MVP (KV + Next.js)

1) `cp .env.example .env.local` and fill KV creds.
2) `pnpm i` (or npm/yarn) and `pnpm dev`.
3) Hit `/` → auto-creates a mock user via middleware.
4) Create a team, generate invites, or join with a token.
5) Payments are stubbed; swap provider in `src/lib/payments/provider.ts`.
