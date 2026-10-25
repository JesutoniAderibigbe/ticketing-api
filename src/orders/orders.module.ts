import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Order } from './entities/order.entity';
import { Ticket } from './entities/ticket.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { OrderRepository } from './order.repository';
import { WebhookEventRepository } from './webhook-event.repository';
import { PaystackService } from './paystack.service';
import { OrderService } from './order.service';
import { WebhookService } from './webhook.service';
import { OrderController } from './order.controller';
import { WebhookController } from './webhook.controller';
import { PaystackSignatureGuard } from './paystack-signature.guard';
import { EventModule } from '../event/event.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Ticket, WebhookEvent]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    EventModule,
    NotificationsModule,
  ],
  controllers: [OrderController, WebhookController],
  providers: [
    OrderRepository,
    WebhookEventRepository,
    PaystackService,
    OrderService,
    WebhookService,
    PaystackSignatureGuard,
  ],
})
export class OrdersModule {}
