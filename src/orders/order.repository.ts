import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderStatus } from './entities/order-status.enum';

interface CreatePendingOrderParams {
  reference: string;
  buyerId: string;
  ticketTierId: string;
  quantity: number;
  amountKobo: number;
}

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }

  async createPendingOrder(params: CreatePendingOrderParams): Promise<Order> {
    const order = this.create({ ...params, status: OrderStatus.PENDING });

    try {
      return await this.save(order);
    } catch {
      throw new InternalServerErrorException();
    }
  }
}
