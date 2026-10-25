import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { WebhookEventRepository } from './webhook-event.repository';
import { PaystackWebhookPayload } from './paystack-webhook-payload.interface';
import { Order } from './entities/order.entity';
import { OrderStatus } from './entities/order-status.enum';
import { Ticket } from './entities/ticket.entity';
import { TicketStatus } from './entities/ticket-status.enum';
import { TicketTier } from '../event/entities/ticket-tier.entity';
import { NotificationsService } from '../notifications/notifications.service';

const CHARGE_SUCCESS_EVENT = 'charge.success';

interface FulfilmentResult {
  orderId: string;
  ticketIds: string[];
  buyerEmail: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private webhookEventRepository: WebhookEventRepository,
    private notificationsService: NotificationsService,
    private dataSource: DataSource,
  ) {}

  async handlePaystackEvent(payload: PaystackWebhookPayload): Promise<void> {
    const providerEventId =
      payload?.data?.id !== undefined ? String(payload.data.id) : undefined;

    if (!providerEventId) {
      this.logger.warn(
        `Paystack webhook missing data.id, event type "${payload?.event}"`,
      );
      return;
    }

    const isNewEvent = await this.webhookEventRepository.recordEvent(
      providerEventId,
      payload.event,
    );

    if (!isNewEvent) {
      this.logger.log(
        `Duplicate Paystack webhook event "${providerEventId}", ignoring`,
      );
      return;
    }

    if (payload.event !== CHARGE_SUCCESS_EVENT) {
      this.logger.log(`Ignoring unhandled Paystack event "${payload.event}"`);
      return;
    }

    await this.fulfilOrder(payload);
  }

  private async fulfilOrder(payload: PaystackWebhookPayload): Promise<void> {
    const { reference, amount } = payload.data;

    const result = await this.dataSource.transaction(
      async (manager): Promise<FulfilmentResult | null> => {
        const order = await manager.findOne(Order, {
          where: { reference },
          relations: { buyer: true },
        });

        if (!order) {
          this.logger.error(
            `No order found for Paystack reference "${reference}"`,
          );
          return null;
        }

        if (order.status !== OrderStatus.PENDING) {
          this.logger.log(
            `Order ${order.id} already processed (status=${order.status}); ignoring duplicate fulfilment`,
          );
          return null;
        }

        if (amount !== order.amountKobo) {
          this.logger.error(
            `Amount mismatch for order ${order.id}: expected ${order.amountKobo}, got ${amount}. Not issuing tickets, flagging for manual review.`,
          );
          return null;
        }

        await manager.increment(
          TicketTier,
          { id: order.ticketTierId },
          'quantitySold',
          order.quantity ?? 0,
        );

        order.status = OrderStatus.PAID;
        order.paidAt = new Date();
        await manager.save(order);

        const tickets = Array.from(
          { length: order.quantity ?? 0 },
          (): Ticket =>
            manager.create(Ticket, {
              orderId: order.id,
              ticketTierId: order.ticketTierId,
              code: randomBytes(16).toString('hex'),
              status: TicketStatus.ISSUED,
            }),
        );

        await manager.save(tickets);

        return {
          orderId: order.id as string,
          ticketIds: tickets.map((ticket) => ticket.id as string),
          buyerEmail: order.buyer?.email as string,
        };
      },
    );

    if (!result) {
      return;
    }

    // Enqueued AFTER the transaction commits — a worker picking this job up
    // immediately must be able to find committed rows, not ones still
    // sitting inside an open transaction.
    await this.notificationsService.enqueueTicketDelivery(
      result.orderId,
      result.ticketIds,
      result.buyerEmail,
    );
    await this.notificationsService.enqueueOrderConfirmation(
      result.orderId,
      result.buyerEmail,
    );
  }
}
