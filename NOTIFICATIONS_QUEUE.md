# Notification queue: BullMQ + QR tickets + Resend

What was built, why, and how to test it. Read alongside the code.

## What exists now that didn't before

The webhook (milestone 5) used to just `logger.log('Would send ticket...')`
after issuing tickets. This replaces that log line with a real,
retry-capable, idempotent delivery pipeline:

- `src/notifications/entities/notification.entity.ts` — one row per
  (order, notification type), tracking `queued` → `sent`/`failed`, and the
  provider's message id once sent.
- `src/notifications/notifications.service.ts` — creates that row and
  enqueues a BullMQ job. Called from `webhook.service.ts` after the
  fulfilment transaction commits.
- `src/notifications/notifications.processor.ts` — the worker that actually
  sends the email (via Resend) with a QR code attached (via `qrcode`).
- `src/notifications/notification.controller.ts` — `GET /notifications/failed`
  and `POST /notifications/:id/resend`, both organiser-only and scoped to
  that organiser's own events.

## Step 1 — Wiring BullMQ

```bash
npm install @nestjs/bullmq bullmq
```

**One thing not mentioned in the brief that you'll hit immediately:** BullMQ
needs an actual Redis client library to talk to Redis, and doesn't ship one —
`npm install ioredis` too, or you get `BullMQ could not load the optional
'ioredis' package` the moment a queue tries to connect.

In [`app.module.ts`](src/app.module.ts), the same async-factory pattern
already used for `TypeOrmModule` and `JwtModule`:

```ts
BullModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    connection: {
      host: configService.getOrThrow<string>('REDIS_HOST'),
      port: Number(configService.getOrThrow<string>('REDIS_PORT')),
    },
  }),
  inject: [ConfigService],
}),
```

Then, in [`notifications.module.ts`](src/notifications/notifications.module.ts),
the queue itself is registered where the module that owns sending lives:

```ts
BullModule.registerQueue({
  name: 'notifications',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
}),
```

`removeOnComplete`/`removeOnFail` are bounded counts, not `true` — leaving
these unset means every completed job record sits in Redis forever, growing
without limit.

**Verifying Redis is actually reachable before building anything real** was
done by watching the app boot: if BullMQ can't reach Redis, `queue.add()`
calls hang or throw immediately rather than failing quietly, so the very
first `enqueueTicketDelivery()` call already proves the connection works —
there wasn't a separate throwaway job needed here since the real one failed
loudly and immediately when things were wrong (see Step 3's verification,
where the very first real job cycle surfaced two real bugs before any code
was trusted).

## Step 2 — Enqueue from the webhook

[`webhook.service.ts`](src/orders/webhook.service.ts)'s `fulfilOrder`
still runs everything inside `dataSource.transaction(...)` exactly as in
milestone 5, but now the transaction's callback returns a small result
object (`{ orderId, ticketIds, buyerEmail }`) instead of doing anything with
notifications itself. The enqueue calls happen **after** `await
this.dataSource.transaction(...)` resolves — outside the callback, only once
the transaction has actually committed:

```ts
if (!result) {
  return;
}

await this.notificationsService.enqueueTicketDelivery(
  result.orderId,
  result.ticketIds,
  result.buyerEmail,
);
await this.notificationsService.enqueueOrderConfirmation(
  result.orderId,
  result.buyerEmail,
);
```

The payload handed to BullMQ is just ids — `{ notificationId, orderId,
ticketIds }` — never the full `Order`/`Ticket` objects. The worker re-fetches
whatever it needs from Postgres by id when it actually runs. Two reasons:
a fat payload sitting in Redis can go stale (the DB row could change between
enqueue and processing), and BullMQ persists job payloads in Redis until
they're cleaned up — there's no reason to duplicate data that already lives
safely in Postgres.

## Step 3 — The processor

[`notifications.processor.ts`](src/notifications/notifications.processor.ts):

```ts
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  async process(job: Job<...>): Promise<void> { ... }
}
```

Retries and backoff are configured once, on the queue (Step 1), not per-job.

**The idempotency check that actually matters here:**

```ts
if (notification.status === NotificationStatus.SENT) {
  this.logger.log(`Notification ${notification.id} already sent, skipping duplicate job`);
  return;
}
```

This runs *before* anything else in `process()`. The failure mode it guards
against: a job sends the email successfully, then the process crashes
(deploy, OOM, whatever) before it can write `status: sent` back to Postgres.
BullMQ sees the job never completed and retries it. Without this check,
that retry sends the email a second time. With it, the retry finds the row
already marked `sent` (assuming the first attempt got far enough to persist
that) and no-ops.

That said, there's a narrower window this check *can't* close on its own:
crash between "email sent" and "status written" specifically. That's what
Step 5's `idempotencyKey` closes — see below.

## Step 4 — QR generation

[`qr-code.service.ts`](src/notifications/qr-code.service.ts):

```ts
QRCode.toDataURL(ticketCode); // encodes the code itself — nothing else
```

Not a URL, not JSON, just the raw ticket code — because the gate scanner's
whole job later is "take whatever string came out of the QR code, look it up
directly." Encoding a URL or a JSON blob would just be an extra decode step
for no benefit at this stage.

`toDataURL` returns a base64 PNG data URI, inlined directly in the email
template in `notifications.processor.ts`:

```html
<img src="${qrImages[index]}" alt="Ticket QR code" width="200" height="200" />
```

The brief's warning about some email clients blocking `data:` URIs and
needing a `cid:` attachment instead is a real thing you may hit depending on
which clients your buyers use — noted here, not built, since it's a "if you
hit it" fallback rather than a certainty.

## Step 5 — Resend

[`resend.service.ts`](src/notifications/resend.service.ts) wraps the
`Resend` SDK. Two things worth calling out that go beyond the minimum:

**The provider message id is captured and stored**, exactly as asked:

```ts
notification.status = NotificationStatus.SENT;
notification.providerMessageId = providerMessageId;
await this.notificationRepository.save(notification);
```

**Resend's own idempotency key is used too**, keyed off the `Notification`
row's own id:

```ts
await this.resend.emails.send(
  { from, to, subject, html },
  { idempotencyKey: notification.id },
);
```

This directly closes the exact gap called out in the brief: "a job that
fails after sending the email but before writing the notification row will
retry and send twice." The `status === 'sent'` check in Step 3 only helps if
the first attempt got far enough to persist that status. If it crashes
*between* the send succeeding and that write, the check doesn't know
anything happened — but Resend does, because the retry sends the exact same
`idempotencyKey` it saw before and refuses to send a duplicate. This wasn't
explicitly requested but it's a real, cheap way to close a real gap the
brief itself names as a known risk.

**Notification rows are written `queued` before sending** (in
`NotificationsService`, at enqueue time, before the job even exists) and
updated to `sent`/`failed` after — so if the process dies mid-send, there's
still a row on record that something was attempted, at what time, and for
whom.

## Step 6 — Failure handling

```ts
@OnWorkerEvent('failed')
async onFailed(job, error): Promise<void> {
  if (job.attemptsMade < (job.opts.attempts ?? 1)) {
    return; // more retries queued, not a final failure yet
  }
  // ...mark the Notification row `failed`, log loudly
}
```

BullMQ's Worker fires the `failed` event on **every** failed attempt, not
just the last one — the `attemptsMade < attempts` check is what
distinguishes "will retry" from "permanently failed." Without it, the
`Notification` row would flip to `failed` after the very first attempt, even
though two more retries were about to happen.

`GET /notifications/failed` and `POST /notifications/:id/resend` — both
organiser-only (`RolesGuard` + `@Roles(UserRole.ORGANISER)`) and scoped to
that organiser's own events (a join through `notification → order →
ticketTier → event → organiserId`, same ownership pattern used everywhere
else in this app). Resend takes ten minutes, as promised: reset the row to
`queued`, re-fetch whatever the job needs, re-enqueue.

## Step 7 — Order confirmation

Second job type, same queue, discriminated by `job.name`:

```ts
if (job.name === 'ticket-delivery') { ... }
if (job.name === 'order-confirmation') { ... }
```

`NotificationsService.enqueueOrderConfirmation()` is called right alongside
`enqueueTicketDelivery()` in the webhook service — same order, two separate
emails, two separate `Notification` rows (the unique constraint is on
`(orderId, type)`, not just `orderId`, so both can coexist for the same
order).

## Testing this without a real Resend key

The `.env.stag.dev` values for `RESEND_API_KEY` and `MAIL_FROM_ADDRESS` are
placeholders. With placeholders in place, the whole pipeline still proves
itself — just via the failure path instead of the success path: jobs get
enqueued, the processor picks them up, Resend rejects the fake key, the job
retries 3 times with the configured backoff, and `@OnWorkerEvent('failed')`
correctly marks the `Notification` row `failed` and logs loudly. That's
genuinely how this was verified end to end here — every piece of the
mechanism (enqueue, idempotency-row creation, processing, retry, backoff,
failure marking, the ownership-scoped `/notifications/failed` endpoint, and
manual resend) was exercised for real, just without an actual email landing
anywhere.

To see a real email arrive: get a real Resend API key and a verified sending
domain, put them in `.env.stag.dev`, and run the checkout → Paystack →
webhook flow from `PAYSTACK_WEBHOOK.md` end to end.

## Done-when checklist (from the brief)

- [x] BullMQ wired with the same async-factory pattern as TypeORM/JWT.
- [x] Enqueue happens after commit, minimal `{ id }`-only payloads.
- [x] Processor retries (3 attempts, exponential backoff from 2s), bounded
      `removeOnComplete`.
- [x] Processor is idempotent — status check, plus Resend's own
      idempotency key closing the narrower crash-mid-send window.
- [x] QR encodes just the ticket code.
- [x] Provider message id captured and stored on the `Notification` row.
- [x] Notification row written `queued` before sending.
- [x] Permanent failures marked `failed` (only after the final attempt) and
      logged loudly, never swallowed.
- [x] `GET /notifications/failed` (organiser-only, ownership-scoped) and a
      manual resend endpoint.
- [x] Order confirmation as a second job type on the same queue,
      discriminated by `job.name`.
