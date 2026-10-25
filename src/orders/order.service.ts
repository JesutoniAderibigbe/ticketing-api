import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OrderRepository } from './order.repository';
import { PaystackService } from './paystack.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { TicketTierRepository } from '../event/ticket-tier.repository';
import { User } from '../users/entities/user.entity';

export interface CheckoutResult {
  reference: string;
  authorizationUrl: string;
}

@Injectable()
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private ticketTierRepository: TicketTierRepository,
    private paystackService: PaystackService,
  ) {}

  async checkout(
    tierId: string,
    createOrderDto: CreateOrderDto,
    user: User,
  ): Promise<CheckoutResult> {
    const tier = await this.ticketTierRepository.findPurchasableTier(tierId);
    const quantity = createOrderDto.quantity ?? 0;
    const maxPerOrder = tier.maxPerOrder ?? 5;

    if (quantity > maxPerOrder) {
      throw new BadRequestException(
        `quantity cannot exceed maxPerOrder (${maxPerOrder}) for this tier`,
      );
    }

    const remaining = (tier.quantityTotal ?? 0) - (tier.quantitySold ?? 0);
    if (quantity > remaining) {
      throw new BadRequestException(
        `Only ${remaining} ticket(s) remaining for this tier`,
      );
    }

    const reference = randomUUID();
    const amountKobo = (tier.priceKobo ?? 0) * quantity;

    const order = await this.orderRepository.createPendingOrder({
      reference,
      buyerId: user.id as string,
      ticketTierId: tier.id as string,
      quantity,
      amountKobo,
    });

    const { authorizationUrl } =
      await this.paystackService.initializeTransaction({
        email: user.email as string,
        amountKobo,
        reference: order.reference as string,
      });

    return { reference: order.reference as string, authorizationUrl };
  }
}
