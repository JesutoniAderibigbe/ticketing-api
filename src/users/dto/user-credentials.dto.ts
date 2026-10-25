import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../entities/user-role.enum';

export class AuthCredentialsDto {
  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain an uppercase, lowercase, numbers and a special characters',
  })
  password?: string;

  @IsEnum(UserRole, { message: 'role must be either organiser or buyer' })
  @IsNotEmpty()
  role?: UserRole;
}
