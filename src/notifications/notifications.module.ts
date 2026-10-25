import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Notification } from './entities/notification.entity';
import { NotificationRepository } from './notification.repository';
import { ResendService } from './resend.service';
import { QrCodeService } from './qr-code.service';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationController } from './notification.controller';
import { Order } from '../orders/entities/order.entity';
import { Ticket } from '../orders/entities/ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Order, Ticket]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    BullModule.registerQueue({
      name: 'notifications',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationRepository,
    ResendService,
    QrCodeService,
    NotificationsService,
    NotificationsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
