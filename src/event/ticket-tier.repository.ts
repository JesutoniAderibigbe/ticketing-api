import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { TicketTier } from './entities/ticket-tier.entity';
import { EventStatus } from './entities/event-status.enum';
import { CreateTicketTierDto } from './dto/create-ticket-tier.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TicketTierRepository extends Repository<TicketTier> {
  constructor(dataSource: DataSource) {
    super(TicketTier, dataSource.createEntityManager());
  }

  async createTicketTier(
    eventId: string,
    createTicketTierDto: CreateTicketTierDto,
  ): Promise<TicketTier> {
    const { name, priceKobo, quantityTotal, maxPerOrder } = createTicketTierDto;

    const ticketTier = this.create({
      eventId,
      name,
      priceKobo,
      quantityTotal,
      maxPerOrder,
    });

    try {
      return await this.save(ticketTier);
    } catch {
      throw new InternalServerErrorException();
    }
  }

  async findOwnedTicketTier(id: string, user: User): Promise<TicketTier> {
    const ticketTier = await this.createQueryBuilder('ticketTier')
      .innerJoin('ticketTier.event', 'event')
      .where('ticketTier.id = :id', { id })
      .andWhere('event.organiserId = :organiserId', { organiserId: user.id })
      .getOne();

    if (!ticketTier) {
      throw new NotFoundException(`Ticket tier with id "${id}" not found`);
    }

    return ticketTier;
  }

  async saveTicketTier(ticketTier: TicketTier): Promise<TicketTier> {
    try {
      return await this.save(ticketTier);
    } catch {
      throw new InternalServerErrorException();
    }
  }

  async hasSellableTier(eventId: string): Promise<boolean> {
    const tier = await this.findOne({
      where: { eventId, quantityTotal: MoreThan(0) },
    });

    return !!tier;
  }

  async findPurchasableTier(id: string): Promise<TicketTier> {
    const tier = await this.createQueryBuilder('ticketTier')
      .innerJoin('ticketTier.event', 'event')
      .where('ticketTier.id = :id', { id })
      .andWhere('event.status = :status', { status: EventStatus.PUBLISHED })
      .getOne();

    if (!tier) {
      throw new NotFoundException(`Ticket tier with id "${id}" not found`);
    }

    return tier;
  }
}
