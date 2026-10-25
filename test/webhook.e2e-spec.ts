import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Order } from '../src/orders/entities/order.entity';
import { OrderStatus } from '../src/orders/entities/order-status.enum';
import { Ticket } from '../src/orders/entities/ticket.entity';
import { WebhookEvent } from '../src/orders/entities/webhook-event.entity';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/entities/user-role.enum';
import { Event } from '../src/event/entities/event.entity';
import { EventStatus } from '../src/event/entities/event-status.enum';
import { TicketTier } from '../src/event/entities/ticket-tier.entity';

describe('Paystack webhook (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let secretKey: string;

  let buyer: User;
  let event: Event;
  let ticketTier: TicketTier;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    secretKey = process.env.PAYSTACK_SECRET_KEY as string;

    buyer = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `webhook-e2e-${randomUUID()}@example.com`,
        passwordHash: 'unused-in-this-test',
        role: UserRole.BUYER,
      }),
    );

    event = await dataSource.getRepository(Event).save(
      dataSource.getRepository(Event).create({
        organiserId: buyer.id,
        title: 'Webhook e2e event',
        description: 'desc',
        venue: 'venue',
        startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: EventStatus.PUBLISHED,
      }),
    );

    ticketTier = await dataSource.getRepository(TicketTier).save(
      dataSource.getRepository(TicketTier).create({
        eventId: event.id,
        name: 'General',
        priceKobo: 100000,
        quantityTotal: 50,
        quantitySold: 0,
      }),
    );
  });

  afterAll(async () => {
    await dataSource
      .getRepository(Ticket)
      .delete({ ticketTierId: ticketTier.id });
    await dataSource
      .getRepository(Order)
      .delete({ ticketTierId: ticketTier.id });
    await dataSource.getRepository(TicketTier).delete({ id: ticketTier.id });
    await dataSource.getRepository(Event).delete({ id: event.id });
    await dataSource.getRepository(User).delete({ id: buyer.id });
    await app.close();
  });

  function sign(body: string): string {
    return createHmac('sha512', secretKey).update(body).digest('hex');
  }

  async function seedPendingOrder(
    reference: string,
    quantity: number,
    amountKobo: number,
  ): Promise<Order> {
    return dataSource.getRepository(Order).save(
      dataSource.getRepository(Order).create({
        reference,
        buyerId: buyer.id,
        ticketTierId: ticketTier.id,
        quantity,
        amountKobo,
        status: OrderStatus.PENDING,
      }),
    );
  }

  it('fulfils an order exactly once even when the same webhook is delivered twice', async () => {
    const reference = `e2e-ref-${randomUUID()}`;
    const order = await seedPendingOrder(reference, 2, 200000);

    const payload = {
      event: 'charge.success',
      data: { id: Date.now(), reference, amount: 200000 },
    };
    const body = JSON.stringify(payload);
    const signature = sign(body);

    const first = await request(app.getHttpServer())
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(body);

    const second = await request(app.getHttpServer())
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const tickets = await dataSource
      .getRepository(Ticket)
      .find({ where: { orderId: order.id } });
    expect(tickets).toHaveLength(2);

    const updatedTier = await dataSource
      .getRepository(TicketTier)
      .findOneByOrFail({ id: ticketTier.id });
    expect(updatedTier.quantitySold).toBe(2);

    const updatedOrder = await dataSource
      .getRepository(Order)
      .findOneByOrFail({ id: order.id });
    expect(updatedOrder.status).toBe(OrderStatus.PAID);

    const webhookEvents = await dataSource
      .getRepository(WebhookEvent)
      .find({ where: { providerEventId: String(payload.data.id) } });
    expect(webhookEvents).toHaveLength(1);
  });

  it('rejects a tampered signature with 401 and makes no state changes', async () => {
    const reference = `e2e-ref-${randomUUID()}`;
    await seedPendingOrder(reference, 1, 100000);

    const payload = {
      event: 'charge.success',
      data: { id: Date.now(), reference, amount: 100000 },
    };
    const body = JSON.stringify(payload);

    const response = await request(app.getHttpServer())
      .post('/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'not-a-real-signature')
      .send(body);

    expect(response.status).toBe(401);

    const order = await dataSource
      .getRepository(Order)
      .findOneByOrFail({ reference });
    expect(order.status).toBe(OrderStatus.PENDING);

    const tickets = await dataSource
      .getRepository(Ticket)
      .find({ where: { orderId: order.id } });
    expect(tickets).toHaveLength(0);
  });
});
