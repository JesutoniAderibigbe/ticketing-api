import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { EventStatus } from './entities/event-status.enum';
import { CreateEventDto } from './dto/create-event.dto';
import { GetFilteredEventsDto } from './dto/get-filtered-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { BrowseEventsDto } from './dto/browse-events.dto';
import { User } from '../users/entities/user.entity';

export interface PaginatedEvents {
  data: Event[];
  total: number;
}

@Injectable()
export class EventRepository extends Repository<Event> {
  constructor(dataSource: DataSource) {
    super(Event, dataSource.createEntityManager());
  }

  async createEvent(
    createEventDto: CreateEventDto,
    user: User,
  ): Promise<Event> {
    const { title, description, venue, startsAt } = createEventDto;

    const event = this.create({
      title,
      description,
      venue,
      startsAt,
      organiserId: user.id,
    });

    try {
      return await this.save(event);
    } catch {
      throw new InternalServerErrorException();
    }
  }

  async getFilteredEvents(
    filterDto: GetFilteredEventsDto,
    user: User,
  ): Promise<Event[]> {
    const { title, venue, status } = filterDto;

    const query = this.createQueryBuilder('event');
    query.where('event.organiserId = :organiserId', { organiserId: user.id });

    if (title) {
      query.andWhere('event.title ILIKE :title', { title: `%${title}%` });
    }

    if (venue) {
      query.andWhere('event.venue ILIKE :venue', { venue: `%${venue}%` });
    }

    if (status) {
      query.andWhere('event.status = :status', { status });
    }

    return query.getMany();
  }

  async findOwnedEvent(id: string, user: User): Promise<Event> {
    const event = await this.findOne({
      where: { id, organiserId: user.id },
    });

    if (!event) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }

    return event;
  }

  async updateEvent(
    id: string,
    updateEventDto: UpdateEventDto,
    user: User,
  ): Promise<Event> {
    const event = await this.findOwnedEvent(id, user);

    const updates = Object.fromEntries(
      Object.entries(updateEventDto).filter(([, value]) => value !== undefined),
    );
    Object.assign(event, updates);

    return this.saveEvent(event);
  }

  async saveEvent(event: Event): Promise<Event> {
    try {
      return await this.save(event);
    } catch {
      throw new InternalServerErrorException();
    }
  }

  async findPublishedEvents(
    filterDto: BrowseEventsDto,
    limit: number,
    offset: number,
  ): Promise<PaginatedEvents> {
    const { search, startsAtFrom, startsAtTo } = filterDto;

    const query = this.createQueryBuilder('event');
    query.where('event.status = :status', { status: EventStatus.PUBLISHED });
    query.andWhere('event.startsAt > :now', { now: new Date() });

    if (search) {
      query.andWhere(
        '(event.title ILIKE :search OR event.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (startsAtFrom) {
      query.andWhere('event.startsAt >= :startsAtFrom', { startsAtFrom });
    }

    if (startsAtTo) {
      query.andWhere('event.startsAt <= :startsAtTo', { startsAtTo });
    }

    query.orderBy('event.startsAt', 'ASC');
    query.take(limit);
    query.skip(offset);

    const [data, total] = await query.getManyAndCount();

    return { data, total };
  }

  async findPublicEventById(id: string): Promise<Event> {
    const event = await this.findOne({
      where: { id, status: EventStatus.PUBLISHED },
      relations: { ticketTiers: true },
    });

    if (!event) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }

    return event;
  }
}
