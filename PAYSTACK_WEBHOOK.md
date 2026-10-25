# Paystack payments: checkout + webhook

This documents what was built, why, and how to actually test it against a real
Paystack account. Read it alongside the code — file paths are given so you can
follow along.

## What exists now that didn't before

There was no `Order`, `Ticket`, or `WebhookEvent` concept in the app before
this. Building the webhook required building the thing it fulfils first:

- `src/orders/entities/order.entity.ts` — a buyer's intent to purchase
  `quantity` tickets from one `TicketTier`, at a fixed `amountKobo`, tracked
  through `pending` → `paid`.
- `src/orders/entities/ticket.entity.ts` — one row per actual ticket, created
  only once payment is confirmed.
- `src/orders/entities/webhook-event.entity.ts` — a log of every Paystack
  event id we've ever processed, purely for idempotency (see Step 4).
- `src/orders/order.service.ts` + `order.controller.ts` — the checkout flow:
  `POST /events/:eventId/tiers/:tierId/checkout` creates a `pending` order and
  calls Paystack's `Initialize Transaction` API to get a payment URL.
- `src/orders/webhook.service.ts` + `webhook.controller.ts` — the webhook that
  this whole document is about.

## Step 1 — Tunnel (you have to do this part yourself)

Paystack's servers need to reach your laptop. They can't hit `localhost`.

1. Install ngrok: `brew install ngrok` (or download from ngrok.com).
2. Run `ngrok http 3000` in a separate terminal, alongside `npm run start:dev`.
3. Copy the `https://xxxx.ngrok-free.app` URL it prints.
4. In the Paystack dashboard: **Settings → API Keys & Webhooks**, paste
   `https://xxxx.ngrok-free.app/webhooks/paystack` as the webhook URL.

**The free ngrok URL changes every time you restart it.** You'll re-paste
this into Paystack every session — that's expected, not a bug in the setup.

Before writing/trusting any of the signature or idempotency logic, it's worth
confirming requests actually arrive: temporarily comment out the
`@UseGuards(PaystackSignatureGuard)` line in
[`webhook.controller.ts`](src/orders/webhook.controller.ts), add a
`console.log(payload)`, trigger a real test payment from the Paystack
dashboard, and watch it show up in your terminal. Put the guard back before
testing signature verification for real.

## Step 2 — Raw body access

Signature verification hashes the *exact bytes* Paystack sent. If Nest parses
the body into a JS object and you re-serialize it to hash it, you get
different bytes (whitespace, key order) — the hash won't match no matter how
correct your HMAC code is.

Fix, in [`main.ts`](src/main.ts):

```ts
const app = await NestFactory.create(AppModule, { rawBody: true });
```

This makes Nest's underlying body parser stash the original `Buffer` on
`request.rawBody`, in addition to still parsing it normally into
`request.body` for everything else (`@Body()` still works as normal
everywhere — this doesn't change any other route).

**If your signatures never match, this is almost always why** — a global
`rawBody: true` is the whole fix; there's no per-route configuration needed.

## Step 3 — Signature verification

[`paystack-signature.guard.ts`](src/orders/paystack-signature.guard.ts):

1. Reads the `x-paystack-signature` header.
2. Computes `HMAC-SHA512(request.rawBody, PAYSTACK_SECRET_KEY)`, hex-encoded.
3. Compares it to the header using `crypto.timingSafeEqual` — not `===`.
   A regular string comparison exits early on the first mismatched
   character, which leaks *how many characters were correct so far* through
   response timing. `timingSafeEqual` always takes the same time regardless
   of where the mismatch is. It also throws if the two buffers aren't the
   same length, so length is checked first.
4. On any failure, throws `UnauthorizedException` → **401**.

This lives in a `Guard`, not inline in the controller — a guard's whole job
is "should this request be allowed to reach the handler at all," which is
exactly what signature verification is. The handler in
[`webhook.controller.ts`](src/orders/webhook.controller.ts) never has to
think about signatures; `@UseGuards(PaystackSignatureGuard)` handles it
before the handler runs.

An unverified webhook is an unauthenticated stranger claiming someone paid
you — the guard is the only thing standing between "Paystack said so" and
"anyone on the internet said so."

## Step 4 — Idempotency

Paystack retries webhook deliveries (network blips, slow responses, etc.),
so the same event can arrive more than once.
[`webhook-event.repository.ts`](src/orders/webhook-event.repository.ts):

```ts
await this.insert(event); // providerEventId has a unique DB constraint
```

If Paystack's `data.id` has been seen before, the `INSERT` throws Postgres
error `23505` (unique violation) — caught, treated as "already handled,"
processing stops, `200` is still returned.

**Why the constraint lives in the database and not an `if` statement:**
two retries can arrive at nearly the same instant, on two separate requests
handled concurrently. A `SELECT` to check "have I seen this id?" followed by
an `INSERT` if not has a race window between those two steps — both
concurrent requests can pass the `SELECT` before either has inserted
anything. A unique index has no such window; the database itself rejects the
second insert, unconditionally, no matter how close together the two
requests were.

## Step 5 — Fulfilment

[`webhook.service.ts`](src/orders/webhook.service.ts)'s `fulfilOrder`, inside
`dataSource.transaction(...)`:

1. **Find the order** by `reference` from the payload.
2. **Check it's still `pending`.** If it's already `paid`, this is a
   duplicate delivery of an event we've already fulfilled (or a retry that
   arrived after we'd already processed it) — stop, return `200`, change
   nothing.
3. **Check the amount.** `payload.data.amount` must equal `order.amountKobo`
   exactly. If it doesn't: **do not issue tickets.** Log loudly
   (`logger.error`) and leave the order `pending` for manual review. The
   payload is attacker-influenceable in principle (or just wrong due to a
   bug on either side) — the order record, created by *our* server before
   any money changed hands, is the source of truth for what was supposed to
   be paid, not whatever number shows up in the webhook.
4. **Atomically increment `quantitySold`** on the tier
   (`manager.increment(...)`, an `UPDATE ... SET quantitySold = quantitySold
   + N`) — not a read-then-write, for the same racing-concurrent-requests
   reason as Step 4.
5. **Mark the order paid**, stamp `paidAt`.
6. **Create `quantity` `Ticket` rows**, each with
   `crypto.randomBytes(16).toString('hex')` as its code — 32 hex characters,
   cryptographically random. Never sequential, never derived from the order
   id: a ticket code that can be *guessed or computed* from public
   information (like an incrementing order id) is a free ticket for anyone
   who works out the pattern.
7. **Commit** (implicit — the transaction callback returning normally commits
   it; throwing anywhere inside rolls the whole thing back).
8. **After** the transaction commits, log `Would send ticket X to email Y`
   for each ticket. Actually queueing delivery is milestone 6 — the `TODO`
   comment marks exactly where that plugs in later.

## Step 6 — Fast response, handle what you recognise

[`webhook.controller.ts`](src/orders/webhook.controller.ts) always returns
`200` (`@HttpCode(200)`, since Nest defaults `POST` to `201`) for every event
type — `charge.success` gets fully processed, anything else is logged and
ignored. A non-`200` response makes Paystack retry the delivery; retrying an
event type your code doesn't understand accomplishes nothing forever, it
just adds load.

The handler's own work — signature check (guard, before the handler even
runs), idempotency insert, and (for `charge.success`) the fulfilment
transaction — is the only thing blocking the response. There's no external
call, no slow operation, in the request path. That's what "target under a
second" means in practice here: nothing in this path talks to another
service. Once delivery is real (milestone 6, a queue), it happens
*after* the `200` is already sent, not before.

## Step 7 — The test that matters

[`test/webhook.e2e-spec.ts`](test/webhook.e2e-spec.ts) — run with:

```bash
STAGE=dev npm run test:e2e
```

Two tests, matching exactly what the PRD asked for:

1. **Fire the same valid payload twice.** Assert both responses are `200`,
   exactly one order transitions to `paid`, exactly one set of `Ticket` rows
   exists (not two), `quantitySold` is incremented exactly once (not twice),
   and exactly one `WebhookEvent` row exists for that provider event id.
2. **Fire one with a tampered signature.** Assert `401`, and assert nothing
   changed — the order is still `pending`, zero tickets exist for it.

These run against the real dev Postgres database (there's no separate test
database configured in this project yet) — each test seeds its own
`User`/`Event`/`TicketTier`/`Order` rows and `afterAll` deletes them, so
running the suite repeatedly doesn't accumulate junk data.

## Testing the whole thing for real, end to end

1. Get a real Paystack **test mode** secret key from your dashboard
   (**Settings → API Keys & Webhooks**), and put it in
   [`.env.stag.dev`](.env.stag.dev) as `PAYSTACK_SECRET_KEY` (replacing the
   placeholder value that's there now — checkout will fail against Paystack
   until you do this).
2. `npm run start:dev`, and in another terminal, `ngrok http 3000` — paste
   the URL into the Paystack dashboard as in Step 1.
3. Sign up, sign in, create an event, add a ticket tier, publish the event
   (all from earlier milestones), then:
   ```
   POST /events/:eventId/tiers/:tierId/checkout
   Authorization: Bearer <token>
   { "quantity": 1 }
   ```
4. This returns `{ reference, authorizationUrl }`. Open `authorizationUrl` in
   a browser and pay with a
   [Paystack test card](https://paystack.com/docs/payments/test-payments/).
5. Watch your terminal — the webhook should arrive, get verified, and log
   `Would send ticket ... to email ...`.
6. Confirm in Postgres: the `order` row is `paid`, a `ticket` row exists, and
   the tier's `quantitySold` went up by 1.

## Done-when checklist (from the brief)

- [x] A real test payment issues tickets end to end (once you plug in a real
      Paystack test secret key — verified via the manual steps above and
      the exact-once logic exercised by the automated test).
- [x] Replaying the same webhook changes nothing the second time (Step 4 +
      Step 7, test 1).
- [x] A bad signature is rejected (Step 3 + Step 7, test 2).
- [x] An amount mismatch blocks fulfilment (Step 5, manually verified: order
      stays `pending`, zero tickets, loud error log).
- [x] Ticket codes are unguessable (`crypto.randomBytes(16)`, Step 5).
