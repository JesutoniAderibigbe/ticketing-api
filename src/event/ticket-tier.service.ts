import { BadRequestException, Injectable } from '@nestjs/common';
import { EventRepository } from './event.repository';
import { TicketTierRepository } from './ticket-tier.repository';
import { CreateTicketTierDto } from './dto/create-ticket-tier.dto';
import { UpdateTicketTierDto } from './dto/update-ticket-tier.dto';
import { TicketTier } from './entities/ticket-tier.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TicketTierService {
  constructor(
    private ticketTierRepository: TicketTierRepository,
    private eventRepository: EventRepository,
  ) {}

  async createTicketTier(
    eventId: string,
    createTicketTierDto: CreateTicketTierDto,
    user: User,
  ): Promise<TicketTier> {
    await this.eventRepository.findOwnedEvent(eventId, user);

    return this.ticketTierRepository.createTicketTier(
      eventId,
      createTicketTierDto,
    );
  }

  async updateTicketTier(
    id: string,
    updateTicketTierDto: UpdateTicketTierDto,
    user: User,
  ): Promise<TicketTier> {
    const ticketTier = await this.ticketTierRepository.findOwnedTicketTier(
      id,
      user,
    );

    const { quantityTotal, priceKobo } = updateTicketTierDto;
    const quantitySold = ticketTier.quantitySold ?? 0;

    if (quantityTotal !== undefined && quantityTotal < quantitySold) {
      throw new BadRequestException(
        `quantityTotal cannot be less than quantitySold (${quantitySold}) — tickets already sold cannot be un-sold`,
      );
    }

    if (priceKobo !== undefined && quantitySold > 0) {
      throw new BadRequestException(
        `priceKobo cannot be changed once quantitySold > 0 (${quantitySold} sold) — price is frozen once sales have started`,
      );
    }

    const updates = Object.fromEntries(
      Object.entries(updateTicketTierDto).filter(
        ([, value]) => value !== undefined,
      ),
    );
    Object.assign(ticketTier, updates);

    return this.ticketTierRepository.saveTicketTier(ticketTier);
  }
}
