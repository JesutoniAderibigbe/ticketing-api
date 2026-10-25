import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { getUser } from '../auth/get-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';

@Controller('notifications')
@UseGuards(AuthGuard(), RolesGuard)
@Roles(UserRole.ORGANISER)
export class NotificationController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('failed')
  getFailedNotifications(@getUser() user: User): Promise<Notification[]> {
    return this.notificationsService.getFailedNotifications(user);
  }

  @Post(':id/resend')
  @HttpCode(200)
  async resendNotification(
    @Param('id') id: string,
    @getUser() user: User,
  ): Promise<{ resent: boolean }> {
    await this.notificationsService.resendNotification(id, user);
    return { resent: true };
  }
}
