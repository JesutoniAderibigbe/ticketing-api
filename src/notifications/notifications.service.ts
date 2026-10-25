import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { NotificationRepository } from './notification.repository';
import { NotificationType } from './entities/notification-type.enum';
import { NotificationStatus } from './entities/notification-status.enum';
import { Notification } from './entities/notification.entity';
import type {
  OrderConfirmationJobData,
  TicketDeliveryJobData,
} from './notification-job-data.interface';
import { Ticket } from '../orders/entities/ticket.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private notificationRepository: NotificationRepository,
    @InjectRepository(Ticket) private ticketRepository: Repository<Ticket>,
  ) {}

  /**
   * Call this AFTER the fulfilment transaction has committed, never from
   * inside it — a worker can be fast enough to pick up the job and look for
   * rows that haven't actually been committed yet.
   */
  async enqueueTicketDelivery(
    orderId: string,
    ticketIds: string[],
    recipientEmail: string,
  ): Promise<void> {
    const notification = await this.notificationRepository.createQueued(
      orderId,
      NotificationType.TICKET_DELIVERY,
      recipientEmail,
    );

    if (!notification) {
      return;
    }

    const jobData: TicketDeliveryJobData = {
      notificationId: notification.id as string,
      orderId,
      ticketIds,
    };
    await this.notificationsQueue.add('ticket-delivery', jobData);
  }

  async enqueueOrderConfirmation(
    orderId: string,
    recipientEmail: string,
  ): Promise<void> {
    const notification = await this.notificationRepository.createQueued(
      orderId,
      NotificationType.ORDER_CONFIRMATION,
      recipientEmail,
    );

    if (!notification) {
      return;
    }

    const jobData: OrderConfirmationJobData = {
      notificationId: notification.id as string,
      orderId,
    };
    await this.notificationsQueue.add('order-confirmation', jobData);
  }

  getFailedNotifications(user: User): Promise<Notification[]> {
    return this.notificationRepository.findFailedForOrganiser(user);
  }

  async resendNotification(id: string, user: User): Promise<void> {
    const notification =
      await this.notificationRepository.findOwnedFailedNotification(id, user);

    notification.status = NotificationStatus.QUEUED;
    await this.notificationRepository.save(notification);

    if (notification.type === NotificationType.TICKET_DELIVERY) {
      const tickets = await this.ticketRepository.find({
        where: { orderId: notification.orderId },
      });

      const jobData: TicketDeliveryJobData = {
        notificationId: notification.id as string,
        orderId: notification.orderId as string,
        ticketIds: tickets.map((ticket) => ticket.id as string),
      };
      await this.notificationsQueue.add('ticket-delivery', jobData);
      return;
    }

    const jobData: OrderConfirmationJobData = {
      notificationId: notification.id as string,
      orderId: notification.orderId as string,
    };
    await this.notificationsQueue.add('order-confirmation', jobData);
  }
}
