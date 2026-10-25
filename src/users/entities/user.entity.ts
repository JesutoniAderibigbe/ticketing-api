import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from './user-role.enum';
import { Event } from '../../event/entities/event.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ unique: true })
  email?: string;

  @Column({ select: false })
  passwordHash?: string;

  @Column({ type: 'enum', enum: UserRole })
  role?: UserRole;

  @OneToMany(() => Event, (event) => event.organiser)
  events?: Event[];
}
