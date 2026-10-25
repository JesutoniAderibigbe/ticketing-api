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
import { TicketTier } from '../../event/entities/ticket-tier.entity';
import { OrderStatus } from './order-status.enum';
import { Ticket } from './ticket.entity';

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ unique: true })
  reference?: string;

  @Column()
  buyerId?: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'buyerId' })
  buyer?: User;

  @Column()
  ticketTierId?: string;

  @ManyToOne(() => TicketTier, { eager: false })
  @JoinColumn({ name: 'ticketTierId' })
  ticketTier?: TicketTier;

  @Column('int')
  quantity?: number;

  @Column('int')
  amountKobo?: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status?: OrderStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.order)
  tickets?: Ticket[];
}
