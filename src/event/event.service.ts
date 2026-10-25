import { BadRequestException, Injectable } from '@nestjs/common';
import { EventRepository, PaginatedEvents } from './event.repository';
import { TicketTierRepository } from './ticket-tier.repository';
import { CreateEventDto } from './dto/create-event.dto';
import { GetFilteredEventsDto } from './dto/get-filtered-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { BrowseEventsDto } from './dto/browse-events.dto';
import { Event } from './entities/event.entity';
import { EventStatus } from './entities/event-status.enum';
import { TicketTier } from './entities/ticket-tier.entity';
import { EVENT_STATUS_TRANSITIONS } from './event-status.transitions';
import { User } from '../users/entities/user.entity';

const DEFAULT_PAGE_LIMIT = 20;

type TicketTierWithRemaining = TicketTier & { remaining: number };
export type EventDetail = Omit<Event, 'ticketTiers'> & {
  ticketTiers: TicketTierWithRemaining[];
};

@Injectable()
export class EventService {
  constructor(
    private eventRepository: EventRepository,
    private ticketTierRepository: TicketTierRepository,
  ) {}

  createEvent(createEventDto: CreateEventDto, user: User): Promise<Event> {
    return this.eventRepository.createEvent(createEventDto, user);
  }

  getFilteredEvents(
    filterDto: GetFilteredEventsDto,
    user: User,
  ): Promise<Event[]> {
    return this.eventRepository.getFilteredEvents(filterDto, user);
  }

  updateEvent(
    id: string,
    updateEventDto: UpdateEventDto,
    user: User,
  ): Promise<Event> {
    return this.eventRepository.updateEvent(id, updateEventDto, user);
  }

  async publishEvent(id: string, user: User): Promise<Event> {
    const event = await this.eventRepository.findOwnedEvent(id, user);
    this.assertValidTransition(
      event.status as EventStatus,
      EventStatus.PUBLISHED,
    );

    const hasSellableTier = await this.ticketTierRepository.hasSellableTier(id);
    if (!hasSellableTier) {
      throw new BadRequestException(
        'Cannot publish an event with no ticket tier that has quantityTotal > 0',
      );
    }

    event.status = EventStatus.PUBLISHED;
    return this.eventRepository.saveEvent(event);
  }

  async cancelEvent(id: string, user: User): Promise<Event> {
    const event = await this.eventRepository.findOwnedEvent(id, user);
    this.assertValidTransition(
      event.status as EventStatus,
      EventStatus.CANCELLED,
    );

    event.status = EventStatus.CANCELLED;
    // TODO(milestone-9): notify all ticket holders that this event was cancelled.
    return this.eventRepository.saveEvent(event);
  }

  browseEvents(filterDto: BrowseEventsDto): Promise<PaginatedEvents> {
    const limit = filterDto.limit ?? DEFAULT_PAGE_LIMIT;
    const offset = filterDto.offset ?? 0;

    return this.eventRepository.findPublishedEvents(filterDto, limit, offset);
  }

  async getEventDetail(id: string): Promise<EventDetail> {
    const event = await this.eventRepository.findPublicEventById(id);

    const ticketTiers = (event.ticketTiers ?? []).map((tier) => ({
      ...tier,
      remaining: (tier.quantityTotal ?? 0) - (tier.quantitySold ?? 0),
    }));

    return { ...event, ticketTiers };
  }

  private assertValidTransition(from: EventStatus, to: EventStatus): void {
    const allowedTransitions = EVENT_STATUS_TRANSITIONS[from];

    if (!allowedTransitions.includes(to)) {
      throw new BadRequestException(
        `Cannot transition event from "${from}" to "${to}"`,
      );
    }
  }
}
