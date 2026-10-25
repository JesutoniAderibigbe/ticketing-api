import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthCredentialsDto } from '../users/dto/user-credentials.dto';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { getUser } from './get-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/signup')
  signUp(@Body() authCredentialsDto: AuthCredentialsDto): Promise<void> {
    return this.authService.signUp(authCredentialsDto);
  }

  @Post('/signin')
  signIn(
    @Body() authCredentialsDto: AuthCredentialsDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.signIn(authCredentialsDto);
  }

  @Get('/me')
  @UseGuards(AuthGuard())
  getMe(@getUser() user: User): string {
    if (!user.email) {
      throw new UnauthorizedException();
    }

    return user.email;
  }
}
