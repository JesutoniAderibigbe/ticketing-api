import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TicketTierService } from './ticket-tier.service';
import { CreateTicketTierDto } from './dto/create-ticket-tier.dto';
import { UpdateTicketTierDto } from './dto/update-ticket-tier.dto';
import { TicketTier } from './entities/ticket-tier.entity';
import { getUser } from '../auth/get-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';

@Controller()
@UseGuards(AuthGuard(), RolesGuard)
@Roles(UserRole.ORGANISER)
export class TicketTierController {
  constructor(private ticketTierService: TicketTierService) {}

  @Post('events/:eventId/tiers')
  createTicketTier(
    @Param('eventId') eventId: string,
    @Body() createTicketTierDto: CreateTicketTierDto,
    @getUser() user: User,
  ): Promise<TicketTier> {
    return this.ticketTierService.createTicketTier(
      eventId,
      createTicketTierDto,
      user,
    );
  }

  @Patch('tiers/:id')
  updateTicketTier(
    @Param('id') id: string,
    @Body() updateTicketTierDto: UpdateTicketTierDto,
    @getUser() user: User,
  ): Promise<TicketTier> {
    return this.ticketTierService.updateTicketTier(
      id,
      updateTicketTierDto,
      user,
    );
  }
}
