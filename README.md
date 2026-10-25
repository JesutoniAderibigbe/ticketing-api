# Ticketing API

A NestJS backend for selling event tickets in Nigeria. Organisers create
events and ticket tiers, buyers check out through **Paystack**, and paid
orders get their tickets emailed with a **QR code** via **Resend**, delivered
through a retrying **BullMQ** queue.

## Stack

- NestJS + TypeORM on **PostgreSQL 16**
- **Redis 7** + BullMQ for the notification queue
- JWT auth (Passport) with organiser / buyer roles
- Paystack for payments (signed, idempotent webhooks)
- Resend for email, `qrcode` for ticket QR codes
- Joi-validated config, rate limiting (`@nestjs/throttler`), health checks (`@nestjs/terminus`)

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/auth/signup` | Create an account |
| POST | `/auth/signin` | Get a JWT |
| GET | `/auth/me` | Current user |
| GET | `/events` | Browse published events (filters) |
| GET | `/events/mine` | Organiser's own events |
| GET | `/events/:id` | One event |
| POST | `/events` | Create an event (organiser) |
| PATCH | `/events/:id` | Update an event |
| POST | `/events/:id/publish` | Publish a draft |
| POST | `/events/:id/cancel` | Cancel an event |
| POST | `/events/:eventId/tiers` | Add a ticket tier |
| PATCH | `/tiers/:id` | Update a ticket tier |
| POST | `/events/:eventId/tiers/:tierId/checkout` | Create a pending order and get a Paystack payment URL |
| POST | `/webhooks/paystack` | Paystack webhook: verifies signature, marks order paid, issues tickets |
| GET | `/notifications/failed` | Failed ticket emails for the organiser's events |
| POST | `/notifications/:id/resend` | Retry a failed ticket email |

## Running locally

```bash
docker compose up -d          # Postgres + Redis
cp .env.example .env.stag.dev # then fill in your Paystack / Resend keys
npm install
npm run start:dev             # STAGE=dev, watches for changes
```

Config is loaded from `.env.stag.<STAGE>`. Those files are git-ignored. Only
`.env.example` is committed.

## Tests

```bash
npm test        # unit
npm run test:e2e
```

## Deeper docs

- [PAYSTACK_WEBHOOK.md](PAYSTACK_WEBHOOK.md): checkout flow, ngrok tunnel, signature guard, idempotency
- [NOTIFICATIONS_QUEUE.md](NOTIFICATIONS_QUEUE.md): BullMQ worker, QR tickets, Resend delivery and retries
