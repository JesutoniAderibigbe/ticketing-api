import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './entities/notification-type.enum';
import { NotificationStatus } from './entities/notification-status.enum';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationRepository extends Repository<Notification> {
  constructor(dataSource: DataSource) {
    super(Notification, dataSource.createEntityManager());
  }

  /**
   * Creates the queued notification row that a job will later reference.
   * Returns null if one already exists for this (orderId, type) pair — the
   * unique constraint on the entity is the actual guard, not this check;
   * this just lets the caller skip enqueueing a job it already knows is
   * redundant.
   */
  async createQueued(
    orderId: string,
    type: NotificationType,
    recipientEmail: string,
  ): Promise<Notification | null> {
    const notification = this.create({ orderId, type, recipientEmail });

    try {
      return await this.save(notification);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return null;
      }
      throw new InternalServerErrorException();
    }
  }

  private ownedByOrganiserQuery(user: User) {
    return this.createQueryBuilder('notification')
      .innerJoin('notification.order', 'order')
      .innerJoin('order.ticketTier', 'ticketTier')
      .innerJoin('ticketTier.event', 'event')
      .where('event.organiserId = :organiserId', { organiserId: user.id });
  }

  async findFailedForOrganiser(user: User): Promise<Notification[]> {
    return this.ownedByOrganiserQuery(user)
      .andWhere('notification.status = :status', {
        status: NotificationStatus.FAILED,
      })
      .orderBy('notification.updatedAt', 'DESC')
      .getMany();
  }

  async findOwnedFailedNotification(
    id: string,
    user: User,
  ): Promise<Notification> {
    const notification = await this.ownedByOrganiserQuery(user)
      .andWhere('notification.id = :id', { id })
      .andWhere('notification.status = :status', {
        status: NotificationStatus.FAILED,
      })
      .getOne();

    if (!notification) {
      throw new NotFoundException(
        `Failed notification with id "${id}" not found`,
      );
    }

    return notification;
  }
}
