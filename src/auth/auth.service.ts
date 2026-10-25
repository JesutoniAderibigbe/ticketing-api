import { Injectable } from '@nestjs/common';
import { AuthCredentialsDto } from '../users/dto/user-credentials.dto';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
  ) {}

  async signUp(authCredentialsDto: AuthCredentialsDto): Promise<void> {
    return this.userRepository.createUser(authCredentialsDto);
  }

  async signIn(
    authCredentialsDto: AuthCredentialsDto,
  ): Promise<{ accessToken: string }> {
    const accessToken =
      await this.userRepository.verifyUser(authCredentialsDto);
    return { accessToken };
  }
}
