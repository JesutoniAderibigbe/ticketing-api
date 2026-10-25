import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrderService, CheckoutResult } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { getUser } from '../auth/get-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('events')
@UseGuards(AuthGuard())
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post(':eventId/tiers/:tierId/checkout')
  checkout(
    @Param('tierId') tierId: string,
    @Body() createOrderDto: CreateOrderDto,
    @getUser() user: User,
  ): Promise<CheckoutResult> {
    return this.orderService.checkout(tierId, createOrderDto, user);
  }
}
