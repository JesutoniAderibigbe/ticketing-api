import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EventStatus } from './event-status.enum';
import { TicketTier } from './ticket-tier.entity';

@Entity()
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  organiserId?: string;

  @ManyToOne(() => User, (user) => user.events, { eager: false })
  @JoinColumn({ name: 'organiserId' })
  organiser?: User;

  @Column()
  title?: string;

  @Column()
  description?: string;

  @Column()
  venue?: string;

  @Column({ type: 'timestamptz' })
  startsAt?: Date;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status?: EventStatus;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @OneToMany(() => TicketTier, (ticketTier) => ticketTier.event)
  ticketTiers?: TicketTier[];
}
