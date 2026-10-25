import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthCredentialsDto } from '../users/dto/user-credentials.dto';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(
    dataSource: DataSource,
    private jwtService: JwtService,
  ) {
    super(User, dataSource.createEntityManager());
  }

  async createUser(authCredentialsDto: AuthCredentialsDto): Promise<void> {
    const { email, password, role } = authCredentialsDto;

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = this.create({ email, passwordHash: hashedPassword, role });

    try {
      await this.save(user);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Email already exists');
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async verifyUser(authCredentialsDto: AuthCredentialsDto): Promise<string> {
    const { email, password } = authCredentialsDto;

    const user = await this.findOne({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true },
    });

    if (!user) {
      throw new ConflictException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new ConflictException('Invalid credentials');
    }

    return this.jwtService.sign({ email: user.email, role: user.role });
  }

  async getUser(email: string): Promise<User> {
    const user = await this.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
