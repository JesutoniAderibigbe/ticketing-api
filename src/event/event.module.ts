import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Event } from './entities/event.entity';
import { TicketTier } from './entities/ticket-tier.entity';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { EventRepository } from './event.repository';
import { TicketTierService } from './ticket-tier.service';
import { TicketTierController } from './ticket-tier.controller';
import { TicketTierRepository } from './ticket-tier.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, TicketTier]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [
    EventService,
    EventRepository,
    TicketTierService,
    TicketTierRepository,
  ],
  controllers: [EventController, TicketTierController],
  exports: [EventRepository, TicketTierRepository],
})
export class EventModule {}
