import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EventService, EventDetail } from './event.service';
import { PaginatedEvents } from './event.repository';
import { CreateEventDto } from './dto/create-event.dto';
import { GetFilteredEventsDto } from './dto/get-filtered-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { BrowseEventsDto } from './dto/browse-events.dto';
import { Event } from './entities/event.entity';
import { getUser } from '../auth/get-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('events')
export class EventController {
  constructor(private eventService: EventService) {}

  @Get()
  browseEvents(@Query() filterDto: BrowseEventsDto): Promise<PaginatedEvents> {
    return this.eventService.browseEvents(filterDto);
  }

  @Get('mine')
  @UseGuards(AuthGuard())
  getFilteredEvents(
    @Query() filterDto: GetFilteredEventsDto,
    @getUser() user: User,
  ): Promise<Event[]> {
    return this.eventService.getFilteredEvents(filterDto, user);
  }

  @Get(':id')
  getEventDetail(@Param('id') id: string): Promise<EventDetail> {
    return this.eventService.getEventDetail(id);
  }

  @Post()
  @UseGuards(AuthGuard())
  createEvent(
    @Body() createEventDto: CreateEventDto,
    @getUser() user: User,
  ): Promise<Event> {
    return this.eventService.createEvent(createEventDto, user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard())
  updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @getUser() user: User,
  ): Promise<Event> {
    return this.eventService.updateEvent(id, updateEventDto, user);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard())
  publishEvent(@Param('id') id: string, @getUser() user: User): Promise<Event> {
    return this.eventService.publishEvent(id, user);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard())
  cancelEvent(@Param('id') id: string, @getUser() user: User): Promise<Event> {
    return this.eventService.cancelEvent(id, user);
  }
}
