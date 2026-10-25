import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Job } from 'bullmq';
import { NotificationRepository } from './notification.repository';
import { ResendService } from './resend.service';
import { QrCodeService } from './qr-code.service';
import { Notification } from './entities/notification.entity';
import { NotificationStatus } from './entities/notification-status.enum';
import type {
  OrderConfirmationJobData,
  TicketDeliveryJobData,
} from './notification-job-data.interface';
import { Order } from '../orders/entities/order.entity';
import { Ticket } from '../orders/entities/ticket.entity';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private notificationRepository: NotificationRepository,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
    @InjectRepository(Ticket) private ticketRepository: Repository<Ticket>,
    private resendService: ResendService,
    private qrCodeService: QrCodeService,
  ) {
    super();
  }

  async process(
    job: Job<TicketDeliveryJobData | OrderConfirmationJobData>,
  ): Promise<void> {
    const notification = await this.notificationRepository.findOneBy({
      id: job.data.notificationId,
    });

    if (!notification) {
      this.logger.warn(
        `Notification ${job.data.notificationId} not found, skipping`,
      );
      return;
    }

    // A job that fails after sending but before recording "sent" will
    // retry — this check is what makes that retry a no-op instead of a
    // second email.
    if (notification.status === NotificationStatus.SENT) {
      this.logger.log(
        `Notification ${notification.id} already sent, skipping duplicate job`,
      );
      return;
    }

    if (job.name === 'ticket-delivery') {
      await this.sendTicketDelivery(
        notification,
        job.data as TicketDeliveryJobData,
      );
      return;
    }

    if (job.name === 'order-confirmation') {
      await this.sendOrderConfirmation(notification, job.data);
      return;
    }

    this.logger.warn(`Unknown notification job name "${job.name}"`);
  }

  private async sendTicketDelivery(
    notification: Notification,
    data: TicketDeliveryJobData,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: data.orderId },
      relations: { ticketTier: { event: true } },
    });

    if (!order) {
      throw new Error(
        `Order ${data.orderId} not found for notification ${notification.id}`,
      );
    }

    const tickets = await this.ticketRepository.find({
      where: { id: In(data.ticketIds) },
    });

    const qrImages = await Promise.all(
      tickets.map((ticket) =>
        this.qrCodeService.toDataUrl(ticket.code as string),
      ),
    );

    const eventTitle = order.ticketTier?.event?.title ?? 'your event';
    const ticketBlocks = tickets
      .map(
        (ticket, index) => `
          <div style="margin-bottom:24px">
            <p>Ticket code: <strong>${ticket.code}</strong></p>
            <img src="${qrImages[index]}" alt="Ticket QR code" width="200" height="200" />
          </div>
        `,
      )
      .join('');

    const html = `
      <h1>${eventTitle}</h1>
      <p>Here ${tickets.length === 1 ? 'is your ticket' : `are your ${tickets.length} tickets`}.</p>
      ${ticketBlocks}
    `;

    const { id: providerMessageId } = await this.resendService.sendEmail({
      to: notification.recipientEmail as string,
      subject: `Your tickets for ${eventTitle}`,
      html,
      idempotencyKey: notification.id as string,
    });

    notification.status = NotificationStatus.SENT;
    notification.providerMessageId = providerMessageId;
    await this.notificationRepository.save(notification);
  }

  private async sendOrderConfirmation(
    notification: Notification,
    data: OrderConfirmationJobData,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: data.orderId },
      relations: { ticketTier: { event: true } },
    });

    if (!order) {
      throw new Error(
        `Order ${data.orderId} not found for notification ${notification.id}`,
      );
    }

    const eventTitle = order.ticketTier?.event?.title ?? 'your event';
    const amountNaira = ((order.amountKobo ?? 0) / 100).toFixed(2);

    const html = `
      <h1>Order confirmed</h1>
      <p>Thanks for your order for ${eventTitle}.</p>
      <p>Quantity: ${order.quantity}</p>
      <p>Amount paid: ₦${amountNaira}</p>
    `;

    const { id: providerMessageId } = await this.resendService.sendEmail({
      to: notification.recipientEmail as string,
      subject: `Order confirmation — ${eventTitle}`,
      html,
      idempotencyKey: notification.id as string,
    });

    notification.status = NotificationStatus.SENT;
    notification.providerMessageId = providerMessageId;
    await this.notificationRepository.save(notification);
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<TicketDeliveryJobData | OrderConfirmationJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts ?? 1;

    if (attemptsMade < maxAttempts) {
      // more retries queued up — don't mark failed yet
      return;
    }

    const notification = await this.notificationRepository.findOneBy({
      id: job.data.notificationId,
    });

    if (notification && notification.status !== NotificationStatus.SENT) {
      notification.status = NotificationStatus.FAILED;
      await this.notificationRepository.save(notification);
    }

    this.logger.error(
      `Notification ${job.data.notificationId} failed permanently after ${attemptsMade} attempts: ${error.message}`,
    );
  }
}
