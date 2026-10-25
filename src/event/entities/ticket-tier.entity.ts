import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity()
export class TicketTier {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  eventId?: string;

  @ManyToOne(() => Event, (event) => event.ticketTiers, { eager: false })
  @JoinColumn({ name: 'eventId' })
  event?: Event;

  @Column()
  name?: string;

  @Column('int')
  priceKobo?: number;

  @Column('int')
  quantityTotal?: number;

  @Column('int', { default: 0 })
  quantitySold?: number;

  @Column('int', { default: 5 })
  maxPerOrder?: number;
}
