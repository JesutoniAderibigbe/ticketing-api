import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TicketTier } from '../../event/entities/ticket-tier.entity';
import { Order } from './order.entity';
import { TicketStatus } from './ticket-status.enum';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  orderId?: string;

  @ManyToOne(() => Order, (order) => order.tickets, { eager: false })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column()
  ticketTierId?: string;

  @ManyToOne(() => TicketTier, { eager: false })
  @JoinColumn({ name: 'ticketTierId' })
  ticketTier?: TicketTier;

  @Column({ unique: true })
  code?: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.ISSUED })
  status?: TicketStatus;

  @CreateDateColumn()
  createdAt?: Date;
}
